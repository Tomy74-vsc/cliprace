/*
Source: POST /api/contests/[id]/leaderboard/recompute
Effects: refresh materialized leaderboard view (global); optional filter ignored
*/
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { getUserRole } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase/server';

export async function POST(
  _req: NextRequest,
  _context: { params: Promise<{ id: string }> }
) {
  try {
    const supabaseSSR = await getSupabaseSSR();
    const { data: { user } } = await supabaseSSR.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    const role = await getUserRole(user.id);
    if (!role) return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });

    const admin = getSupabaseAdmin();
    const { error } = await admin.rpc('refresh_leaderboard');
    if (error) return NextResponse.json({ ok: false, message: 'Refresh failed', error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Server error';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
