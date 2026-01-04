/*
Source: POST /api/contests/[id]/winners/compute
Effects: finalize_contest(p_contest_id) to persist winners; return winners
*/
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { getUserRole } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase/server';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: contestId } = await context.params;
    const supabaseSSR = await getSupabaseSSR();
    const { data: { user } } = await supabaseSSR.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    const role = await getUserRole(user.id);
    if (!role) return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });

    const admin = getSupabaseAdmin();
    const { data: contest, error: cErr } = await admin
      .from('contests')
      .select('id, brand_id')
      .eq('id', contestId)
      .single();
    if (cErr || !contest) return NextResponse.json({ ok: false, message: 'Contest not found' }, { status: 404 });
    const isOwner = contest.brand_id === user.id;
    const isAdmin = role === 'admin';
    if (!isOwner && !isAdmin) return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });

    // Use finalize_contest which persists contest_winnings
    const { error: finErr } = await admin.rpc('finalize_contest', { p_contest_id: contestId });
    if (finErr) return NextResponse.json({ ok: false, message: 'Finalize failed', error: finErr.message }, { status: 500 });

    const { data: winners, error: wErr } = await admin
      .from('contest_winnings')
      .select('creator_id, rank, payout_cents, payout_percentage, calculated_at, paid_at')
      .eq('contest_id', contestId)
      .order('rank', { ascending: true });
    if (wErr) return NextResponse.json({ ok: false, message: 'Load winners failed', error: wErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, winners });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Server error';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
