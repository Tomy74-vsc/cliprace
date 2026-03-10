// Source: GET /api/auth/csrf - Returns CSRF token for client-side forms
// Effects: Returns CSRF token from cookie (for double-submit pattern)
// Security: Uses crypto-strong token generation, never Math.random
import { NextRequest, NextResponse } from 'next/server';
import { generateCsrfToken } from '@/lib/csrf';

export async function GET(req: NextRequest) {
  try {
    // Read CSRF token from cookie in the request
    const csrfToken = req.cookies.get('csrf')?.value;

    // If no token exists, generate one (should be set by middleware, but fallback here)
    if (!csrfToken) {
      const token = generateCsrfToken();
      const secure = process.env.NODE_ENV === 'production';
      
      // Create response with cookie
      const response = NextResponse.json({
        ok: true,
        token: token,
      });
      
      response.cookies.set('csrf', token, {
        httpOnly: true,
        sameSite: 'lax',
        secure,
        path: '/',
        maxAge: 60 * 60 * 24, // 24 hours
      });
      
      return response;
    }

    return NextResponse.json({
      ok: true,
      token: csrfToken,
    });
  } catch (error) {
    console.error('Error in /api/auth/csrf:', error);
    return NextResponse.json(
      { ok: false, message: 'Error retrieving CSRF token' },
      { status: 500 }
    );
  }
}

