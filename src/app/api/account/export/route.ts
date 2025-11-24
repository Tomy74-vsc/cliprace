/*
Source: POST /api/account/export
Effects: export user data JSON
*/
import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ ok: false, message: 'Not implemented' }, { status: 501 });
}

