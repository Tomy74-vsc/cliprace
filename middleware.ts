import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/*
Source: Middleware — CSRF cookie, auth guard /app/*, optional /api/* guard, onboarding
Notes:
- CSRF: httpOnly, SameSite=Lax, Secure (prod), Web Crypto API only
- /app/*: unauthenticated → redirect /auth/login; onboarding_complete=false → redirect /app/onboarding
- Auth check is cookie-based (Supabase session) + one lightweight profile select for onboarding
- /api/* (except /api/auth/*): unauthenticated → 401 (cookie-based check only)
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

/**
 * Create Supabase client for Edge middleware (cookie-based only; no next/headers).
 * Session is read from req.cookies; any refresh/set goes to the provided response.
 */
function createSupabaseMiddlewareClient(req: NextRequest, res: NextResponse) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return req.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: Parameters<typeof res.cookies.set>[2]) {
        res.cookies.set(name, value, options);
      },
      remove(name: string, options: Parameters<typeof res.cookies.set>[2]) {
        res.cookies.set(name, '', { ...options, maxAge: 0 });
      },
    },
  });
}

export async function middleware(req: NextRequest) {
  const url = new URL(req.url);
  const pathname = url.pathname;
  const res = NextResponse.next();

  // ─── Emit CSRF cookie for /auth/* pages and /api/auth/* routes ───
  const isAuthPage = pathname.startsWith('/auth/');
  const isAuthApi = pathname.startsWith('/api/auth/');

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

  // ─── Protect /app/* (except /app/onboarding): require auth + onboarding ───
  if (pathname.startsWith('/app/') && !pathname.startsWith('/app/onboarding')) {
    const supabase = createSupabaseMiddlewareClient(req, res);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    // 1. No user → redirect to login
    if (authError || !user) {
      return NextResponse.redirect(new URL('/auth/login', req.url));
    }

    // 2. User exists: check onboarding (one lightweight profile select; RLS allows own row)
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_complete')
      .eq('id', user.id)
      .single();

    const onboardingComplete = profile?.onboarding_complete ?? false;
    if (!onboardingComplete) {
      return NextResponse.redirect(new URL('/app/onboarding', req.url));
    }

    return res;
  }

  // Note: /app/* et /api/* sont des namespaces disjoints dans ce repo.
  // Les routes API Next.js sont sous /api/ uniquement (pas /app/api/).
  // Les deux blocs ci-dessus ne peuvent pas se déclencher simultanément.

  // ─── Optional: protect /api/* (except /api/auth/* and webhooks) — cookie-based only, no DB ───
  const isApiProtected =
    pathname.startsWith('/api/') &&
    !pathname.startsWith('/api/auth/') &&
    !pathname.startsWith('/api/payments/stripe/webhook') && // webhook uses Stripe signature, no session
    !pathname.startsWith('/api/cron/');
  if (isApiProtected) {
    const supabase = createSupabaseMiddlewareClient(req, res);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { ok: false, code: 'UNAUTHORIZED', message: 'Authentification requise' },
        { status: 401 }
      );
    }

    return res;
  }

  return res;
}

export const config = {
  matcher: ['/auth/:path*', '/app/:path*', '/api/:path*'],
};
