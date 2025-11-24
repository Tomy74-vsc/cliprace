/*
Source: PATCH /api/contests/[id]/update
Effects: autosave draft steps (update contests/terms/prizes)
*/
import { NextResponse } from 'next/server';

export async function PATCH() {
  return NextResponse.json({ ok: false, message: 'Not implemented' }, { status: 501 });
}

