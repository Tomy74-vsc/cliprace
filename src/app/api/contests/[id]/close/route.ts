/*
Source: POST /api/contests/[id]/close
Tables: contests, status_history, audit_logs
Rules: brand owner or admin; require `now() >= end_at` unless force
*/
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { getUserRole } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase/server';

const BodySchema = z.object({ force: z.boolean().optional() });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const contestId = params.id;
    const supabaseSSR = await getSupabaseSSR();
    const { data: { user } } = await supabaseSSR.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    const role = await getUserRole(user.id);
    if (!role) return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });

    const admin = getSupabaseAdmin();
    const { data: contest, error: cErr } = await admin
      .from('contests')
      .select('id, brand_id, status, end_at')
      .eq('id', contestId)
      .single();
    if (cErr || !contest) return NextResponse.json({ ok: false, message: 'Contest not found' }, { status: 404 });
    const isOwner = contest.brand_id === user.id;
    const isAdmin = role === 'admin';
    if (!isOwner && !isAdmin) return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(body);
    const force = parsed.success ? parsed.data.force === true : false;

    if (!force) {
      const now = new Date();
      const endAt = new Date(contest.end_at);
      if (now < endAt) return NextResponse.json({ ok: false, message: 'Contest has not ended yet' }, { status: 409 });
    }

    const oldStatus = contest.status;
    const { error: updErr } = await admin
      .from('contests')
      .update({ status: 'ended', updated_at: new Date().toISOString() })
      .eq('id', contestId);
    if (updErr) return NextResponse.json({ ok: false, message: 'Update failed', error: updErr.message }, { status: 500 });

    await admin.from('status_history').insert({
      table_name: 'contests',
      row_id: contestId,
      old_status: oldStatus,
      new_status: 'ended',
      changed_by: user.id,
    });

    const ip = req.headers.get('x-forwarded-for') ?? undefined;
    const ua = req.headers.get('user-agent') ?? undefined;
    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'contest_close',
      table_name: 'contests',
      row_pk: contestId,
      old_values: { status: oldStatus },
      new_values: { status: 'ended' },
      ip,
      user_agent: ua,
    });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Server error';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
