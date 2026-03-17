/*
Source: POST /api/contests/[id]/leaderboard/recompute
Effects: refresh materialized leaderboard view (global); optional filter ignored
*/
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { getUserRole } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { assertCsrf } from '@/lib/csrf';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    try {
      assertCsrf(
        req.headers.get('cookie'),
        (req.headers.get('x-csrf-token') || req.headers.get('x-csrf')) ?? null,
      );
    } catch {
      return NextResponse.json({ ok: false, message: 'Invalid CSRF token' }, { status: 403 });
    }

    const { id: contestId } = await context.params;
    const supabaseSSR = await getSupabaseSSR();
    const { data: { user } } = await supabaseSSR.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    const role = await getUserRole(user.id);
    if (!role) return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });

    const admin = getSupabaseAdmin();
    if (role !== 'admin') {
      const { data: contest, error: contestErr } = await admin
        .from('contests')
        .select('id, brand_id')
        .eq('id', contestId)
        .single();
      if (contestErr || !contest) {
        return NextResponse.json({ ok: false, message: 'Contest not found' }, { status: 404 });
      }
      if (contest.brand_id !== user.id) {
        return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
      }
    }

    const { error } = await admin.rpc('refresh_leaderboard');
    if (error) return NextResponse.json({ ok: false, message: 'Refresh failed', error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    console.error('leaderboard:recompute:error', e);
    const message = e instanceof Error ? e.message : 'Server error';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
