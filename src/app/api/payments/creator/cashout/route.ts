/*
Source: POST /api/payments/creator/cashout
Tables: contest_winnings, cashouts, audit_logs
Effects: compute balance; insert cashouts(status='requested') if amount <= balance
*/
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { getUserRole } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rateLimit';
import { assertCsrf } from '@/lib/csrf';
import { getClientIp, buildRateLimitKey } from '@/lib/safe-ip';

const BodySchema = z.object({ amount_cents: z.number().int().positive() });

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 1/min per creator+ip+ua
    const supabaseSSR = await getSupabaseSSR();
    const { data: { user } } = await supabaseSSR.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    const role = await getUserRole(user.id);
    if (role !== 'creator' && role !== 'admin') {
      return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
    }

    const rlKey = buildRateLimitKey('payments:creator:cashout', user.id, req);
    if (!(await rateLimit({ key: rlKey, route: 'payments:creator:cashout', windowMs: 60_000, max: 1 }))) {
      return NextResponse.json({ ok: false, message: 'Rate limit exceeded' }, { status: 429 });
    }

    // CSRF check
    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf') ?? null);
    } catch {
      return NextResponse.json({ ok: false, message: 'Invalid CSRF token' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, message: 'Invalid body', errors: parsed.error.flatten() }, { status: 400 });
    }
    const { amount_cents } = parsed.data;

    const admin = getSupabaseAdmin();
    // Sum winnings
    const { data: winAgg, error: winErr } = await admin
      .from('contest_winnings')
      .select('payout_cents', { count: 'exact' })
      .eq('creator_id', user.id);
    if (winErr) return NextResponse.json({ ok: false, message: 'Load winnings failed', error: winErr.message }, { status: 500 });
    const totalWins = (winAgg || []).reduce((acc, r: { payout_cents?: number }) => acc + (r.payout_cents || 0), 0);

    // Sum pending/processing/paid cashouts
    const { data: cashAgg, error: cashErr } = await admin
      .from('cashouts')
      .select('amount_cents')
      .eq('creator_id', user.id)
      .in('status', ['requested', 'processing', 'paid']);
    if (cashErr) return NextResponse.json({ ok: false, message: 'Load cashouts failed', error: cashErr.message }, { status: 500 });
    const totalCashouts = (cashAgg || []).reduce((acc, r: { amount_cents?: number }) => acc + (r.amount_cents || 0), 0);

    const balance = totalWins - totalCashouts;
    if (balance <= 0 || amount_cents > balance) {
      return NextResponse.json({ ok: false, message: 'Insufficient balance' }, { status: 409 });
    }

    const { error: insErr } = await admin
      .from('cashouts')
      .insert({ creator_id: user.id, amount_cents, currency: 'EUR', status: 'requested' });
    if (insErr) return NextResponse.json({ ok: false, message: 'Cashout insert failed', error: insErr.message }, { status: 500 });

    // Audit
    const auditIp = getClientIp(req);
    const ua = req.headers.get('user-agent') ?? undefined;
    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'cashout_request',
      table_name: 'cashouts',
      row_pk: null,
      new_values: { amount_cents },
      ip: auditIp,
      user_agent: ua,
    });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Server error';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
