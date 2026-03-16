import { NextRequest, NextResponse } from 'next/server';
import { csrfMint } from '@/lib/csrf';

const COOKIE_NAME =
  process.env.NODE_ENV === 'production' ? '__Host-csrf' : 'csrf';

export async function GET(req: NextRequest) {
  try {
    const existing = req.cookies.get(COOKIE_NAME)?.value;

    if (existing) {
      return NextResponse.json({ ok: true, token: existing });
    }

    const token = csrfMint();
    const response = NextResponse.json({ ok: true, token });

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24,
    });

    return response;
  } catch (error) {
    console.error('Error in /api/auth/csrf:', error);
    return NextResponse.json(
      { ok: false, message: 'Error retrieving CSRF token' },
      { status: 500 },
    );
  }
}
