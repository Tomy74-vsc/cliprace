/*
Source: POST /api/payments/brand/fund
Tables: payments_brand, contests, audit_logs
Effects: create payments_brand row first (saga init), create Stripe Checkout Session, bind session to payment row
*/
import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { z } from 'zod';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { getUserRole } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe';
import { rateLimit } from '@/lib/rateLimit';
import { assertCsrf } from '@/lib/csrf';
import { getClientIp, buildRateLimitKey } from '@/lib/safe-ip';

const BodySchema = z.object({
  contest_id: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 3/min per brand
    const supabaseSSR = await getSupabaseSSR();
    const { data: { user } } = await supabaseSSR.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    const role = await getUserRole(user.id);
    if (role !== 'brand' && role !== 'admin') {
      return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
    }

    const rlKey = buildRateLimitKey('payments:brand:fund', user.id, req);
    if (!(await rateLimit({ key: rlKey, route: 'payments:brand:fund', windowMs: 60_000, max: 3 }))) {
      return NextResponse.json({ ok: false, message: 'Rate limit exceeded' }, { status: 429 });
    }

    // CSRF check
    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf') ?? null);
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

    // Step A (Saga): persist internal payment row first.
    // NOTE: DB enum does not have "pending", so we use requires_payment as pending-equivalent.
    const { data: insertedPayment, error: insErr } = await admin
      .from('payments_brand')
      .insert({
      brand_id: contest.brand_id,
      contest_id,
      amount_cents,
      currency,
      status: 'requires_payment',
      metadata: {
        model: isProductContest ? 'product' : 'cash',
        saga_state: 'pending_checkout',
        created_by: user.id,
      },
    })
      .select('id')
      .single();
    if (insErr || !insertedPayment) {
      console.error('fund:saga:init_failed', { contest_id, user_id: user.id, error: insErr?.message });
      return NextResponse.json(
        { ok: false, message: 'Payment saga initialization failed', error: insErr?.message ?? 'Unknown insert error' },
        { status: 500 }
      );
    }

    // Step B (Saga): only after internal persistence succeeded, create Stripe session.
    const stripe = getStripe();
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.create({
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
          internal_payment_id: insertedPayment.id,
          contest_id,
          brand_id: contest.brand_id,
          actor_user_id: user.id,
          contest_type: contest.contest_type,
        },
      });
    } catch (stripeError: unknown) {
      const stripeMessage = stripeError instanceof Error ? stripeError.message : 'Stripe session creation failed';
      console.error('fund:saga:stripe_session_failed', {
        payment_id: insertedPayment.id,
        contest_id,
        user_id: user.id,
        error: stripeMessage,
      });
      await admin
        .from('payments_brand')
        .update({
          status: 'failed',
          metadata: {
            model: isProductContest ? 'product' : 'cash',
            saga_state: 'checkout_creation_failed',
            created_by: user.id,
            stripe_error: stripeMessage,
          },
        })
        .eq('id', insertedPayment.id);

      return NextResponse.json({ ok: false, message: 'Stripe checkout initialization failed' }, { status: 500 });
    }

    // Step C (Saga): bind Stripe session to internal payment row.
    const { error: bindErr } = await admin
      .from('payments_brand')
      .update({
        stripe_checkout_session_id: session.id,
        status: 'requires_payment',
        metadata: {
          model: isProductContest ? 'product' : 'cash',
          saga_state: 'checkout_created',
          created_by: user.id,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', insertedPayment.id);
    if (bindErr) {
      console.error('fund:saga:bind_session_failed', {
        payment_id: insertedPayment.id,
        contest_id,
        user_id: user.id,
        session_id: session.id,
        error: bindErr.message,
      });
      try {
        await stripe.checkout.sessions.expire(session.id);
      } catch (expireErr: unknown) {
        const expireMessage = expireErr instanceof Error ? expireErr.message : 'unknown';
        console.error('fund:saga:expire_session_failed', { session_id: session.id, error: expireMessage });
      }
      return NextResponse.json({ ok: false, message: 'Payment binding failed', error: bindErr.message }, { status: 500 });
    }

    // Audit
    const auditIp = getClientIp(req);
    const ua = req.headers.get('user-agent') ?? undefined;
    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'payments_brand_fund',
      table_name: 'payments_brand',
      row_pk: insertedPayment.id,
      new_values: { contest_id, payment_id: insertedPayment.id, stripe_checkout_session_id: session.id, amount_cents, currency },
      ip: auditIp,
      user_agent: ua,
    });

    return NextResponse.json({ ok: true, checkout_url: session.url });
  } catch (e: unknown) {
    console.error('fund:unhandled_error', e);
    const message = e instanceof Error ? e.message : 'Server error';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
