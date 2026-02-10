/*
Source: POST /api/payments/brand/fund
Tables: payments_brand, contests, audit_logs
Effects: create payments_brand(status='requires_payment'), create Stripe Checkout Session, return checkout_url
*/
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { getUserRole } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe';
import { rateLimit } from '@/lib/rateLimit';
import { assertCsrf } from '@/lib/csrf';

const BodySchema = z.object({
  contest_id: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 3/min per brand
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    const supabaseSSR = await getSupabaseSSR();
    const { data: { user } } = await supabaseSSR.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    const role = await getUserRole(user.id);
    if (role !== 'brand' && role !== 'admin') {
      return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
    }

    const rlKey = `payments:brand:fund:${user.id}:${ip}`;
    if (!(await rateLimit({ key: rlKey, route: 'payments:brand:fund', windowMs: 60_000, max: 3 }))) {
      return NextResponse.json({ ok: false, message: 'Rate limit exceeded' }, { status: 429 });
    }

    // CSRF check
    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf') || undefined);
    } catch {
      return NextResponse.json({ ok: false, message: 'Invalid CSRF token' }, { status: 403 });
    }

    const json = await req.json();
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, message: 'Invalid body', errors: parsed.error.flatten() }, { status: 400 });
    }
    const { contest_id } = parsed.data;

    const admin = getSupabaseAdmin();
    const { data: contest, error: cErr } = await admin
      .from('contests')
      .select('id, brand_id, title, prize_pool_cents, currency, status, contest_type, platform_fee')
      .eq('id', contest_id)
      .single();
    if (cErr || !contest) return NextResponse.json({ ok: false, message: 'Contest not found' }, { status: 404 });
    if (role !== 'admin' && contest.brand_id !== user.id) {
      return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
    }
    if (contest.status === 'active' || contest.status === 'ended' || contest.status === 'archived') {
      return NextResponse.json({ ok: false, message: `Contest status '${contest.status}' is not fundable` }, { status: 409 });
    }

    const currency = contest.currency || 'EUR';
    const isProductContest = contest.contest_type === 'product';

    // Montant ŕ payer :
    // - Concours cash : prize_pool_cents (montant cash)
    // - Concours produit : platform_fee (forfait plateforme)
    const baseAmountCents = isProductContest
      ? contest.platform_fee ?? 0
      : contest.prize_pool_cents ?? 0;

    if (baseAmountCents <= 0) {
      return NextResponse.json(
        { ok: false, message: 'Montant ŕ payer invalide pour ce concours' },
        { status: 409 }
      );
    }

    const amount_cents = baseAmountCents;

    // Create Checkout Session
    const stripe = getStripe();
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: { name: `Funding contest: ${contest.title}` },
            unit_amount: amount_cents,
          },
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/app/brand/contests/${contest_id}?funding=success`,
      cancel_url: `${appUrl}/app/brand/contests/${contest_id}?funding=cancel`,
      metadata: {
        contest_id,
        brand_id: contest.brand_id,
        actor_user_id: user.id,
        contest_type: contest.contest_type,
      },
    });

    // Insert payments_brand row
    const { error: insErr } = await admin.from('payments_brand').insert({
      brand_id: contest.brand_id,
      contest_id,
      stripe_checkout_session_id: session.id,
      amount_cents,
      currency,
      status: 'requires_payment',
      metadata: {
        model: isProductContest ? 'product' : 'cash',
      },
    });
    if (insErr) return NextResponse.json({ ok: false, message: 'Insert payment failed', error: insErr.message }, { status: 500 });

    // Audit
    const ip2 = req.headers.get('x-forwarded-for') ?? undefined;
    const ua = req.headers.get('user-agent') ?? undefined;
    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'payments_brand_fund',
      table_name: 'payments_brand',
      row_pk: null,
      new_values: { contest_id, stripe_checkout_session_id: session.id, amount_cents, currency },
      ip: ip2,
      user_agent: ua,
    });

    return NextResponse.json({ ok: true, checkout_url: session.url });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Server error';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
