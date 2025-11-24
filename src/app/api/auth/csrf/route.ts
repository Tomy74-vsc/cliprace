// Source: GET /api/auth/csrf - Returns CSRF token for client-side forms
// Effects: Returns CSRF token from cookie (for double-submit pattern)
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    // Read CSRF token from cookie in the request
    let csrfToken = req.cookies.get('csrf')?.value;

    // If no token exists, generate one (should be set by middleware, but fallback here)
    if (!csrfToken) {
      // Generate token using Web Crypto API
      const token = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
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

