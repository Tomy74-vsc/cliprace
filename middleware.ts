import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

/*
Source: Middleware — emit CSRF cookie for /auth/* pages + check onboarding
Notes:
- Sets httpOnly, SameSite=Lax, Secure (prod)
- Token generated via crypto-strong randomness (never Math.random)
- Checks onboarding_complete and redirects if needed
*/

/**
 * Generate a crypto-strong CSRF token for Edge Runtime.
 * Uses Web Crypto API (available in all Edge/Node 18+ runtimes).
 * Throws if crypto is unavailable — never falls back to Math.random.
 */
function generateEdgeCsrfToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  // base64url encoding without Buffer (Edge Runtime compatible)
  const raw = String.fromCharCode(...array);
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export async function middleware(req: NextRequest) {
  const url = new URL(req.url);
  const res = NextResponse.next();

  // Emit CSRF cookie for /auth/* pages and /api/auth/* routes
  const isAuthPage = url.pathname.startsWith('/auth/');
  const isAuthApi = url.pathname.startsWith('/api/auth/');
  
  if (isAuthPage || isAuthApi) {
    const hasCsrf = req.cookies.get('csrf');
    if (!hasCsrf) {
      const token = generateEdgeCsrfToken();
      const secure = process.env.NODE_ENV === 'production';
      res.cookies.set('csrf', token, {
        httpOnly: true,
        sameSite: 'lax',
        secure,
        path: '/',
        maxAge: 60 * 60 * 24, // 24 hours
      });
    }
  }

  // Check onboarding for /app/* routes
  if (url.pathname.startsWith('/app/') && !url.pathname.startsWith('/app/onboarding')) {
    try {
      const { user, error } = await getSession();

      if (!error && user) {
        // getSession() already includes onboarding_complete, no need for extra DB query
        const onboardingComplete = user.onboarding_complete ?? false;

        // Redirect to onboarding if incomplete
        if (!onboardingComplete) {
          return NextResponse.redirect(new URL('/app/onboarding', req.url));
        }
      }
    } catch (error) {
      // If error checking onboarding, allow access (fail open)
      console.error('Middleware onboarding check error:', error);
    }
  }

  return res;
}

export const config = {
  matcher: ['/auth/:path*', '/app/:path*', '/api/auth/:path*'],
};
