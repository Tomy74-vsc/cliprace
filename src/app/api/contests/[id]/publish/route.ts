/*
Source: POST /api/contests/[id]/publish
Tables: contests, payments_brand, status_history, audit_logs
Rules: brand owner or admin; require payments_brand.status='succeeded' unless force
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
    const supabaseSSR = getSupabaseSSR();
    const {
      data: { user },
    } = await supabaseSSR.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    const role = await getUserRole(user.id);
    if (!role) return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });

    const admin = getSupabaseAdmin();
    const { data: contest, error: cErr } = await admin
      .from('contests')
      .select('id, brand_id, status')
      .eq('id', contestId)
      .single();
    if (cErr || !contest) return NextResponse.json({ ok: false, message: 'Contest not found' }, { status: 404 });
    const isOwner = contest.brand_id === user.id;
    const isAdmin = role === 'admin';
    if (!isOwner && !isAdmin) return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(body);
    const force = parsed.success ? parsed.data.force === true : false;

    if (!force || !isAdmin) {
      // require succeeded payment
      const { data: pay, error: pErr } = await admin
        .from('payments_brand')
        .select('id')
        .eq('contest_id', contestId)
        .eq('status', 'succeeded')
        .limit(1)
        .maybeSingle();
      if (pErr) return NextResponse.json({ ok: false, message: 'Payment check failed', error: pErr.message }, { status: 500 });
      if (!pay) return NextResponse.json({ ok: false, message: 'Contest not funded' }, { status: 409 });
    }

    const oldStatus = contest.status;
    const { error: updErr } = await admin
      .from('contests')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', contestId);
    if (updErr) return NextResponse.json({ ok: false, message: 'Update failed', error: updErr.message }, { status: 500 });

    await admin.from('status_history').insert({
      table_name: 'contests',
      row_id: contestId,
      old_status: oldStatus,
      new_status: 'active',
      changed_by: user.id,
    });

    const ip = req.headers.get('x-forwarded-for') ?? req.ip ?? undefined;
    const ua = req.headers.get('user-agent') ?? undefined;
    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'contest_publish',
      table_name: 'contests',
      row_pk: contestId,
      old_values: { status: oldStatus },
      new_values: { status: 'active' },
      ip,
      user_agent: ua,
    });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Server error';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

