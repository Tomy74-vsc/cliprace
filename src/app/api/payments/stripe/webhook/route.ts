/*
Source: POST /api/payments/stripe/webhook
Tables: webhooks_stripe, payments_brand, audit_logs
Effects: verify signature, store event (idempotent), update payments_brand status; publish contest if 'succeeded'
*/
import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import { getSupabaseAdmin } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const stripe = getStripe();
    const sig = req.headers.get('stripe-signature');
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!sig || !secret) {
      return NextResponse.json({ ok: false, message: 'Missing signature' }, { status: 400 });
    }

    const body = await req.text();
    let evt: Stripe.Event;
    try {
      evt = stripe.webhooks.constructEvent(body, sig, secret);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Signature verification failed';
      return NextResponse.json({ ok: false, message: `Signature verification failed: ${message}` }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    const eventId = evt.id as string;
    const eventType = evt.type as string;
    const payload = evt.data?.object ?? {};

    const { data: existing, error: existingErr } = await admin
      .from('webhooks_stripe')
      .select('id, processed')
      .eq('stripe_event_id', eventId)
      .maybeSingle();
    if (existingErr) {
      console.error('webhook:existing_lookup_failed', { eventId, error: existingErr.message });
      return NextResponse.json({ ok: false, message: 'Webhook lookup failed' }, { status: 500 });
    }

    if (!existing) {
      const { error: insertWebhookErr } = await admin.from('webhooks_stripe').insert({
        stripe_event_id: eventId,
        event_type: eventType,
        payload,
        processed: false,
      });
      if (insertWebhookErr) {
        console.error('webhook:insert_event_failed', { eventId, error: insertWebhookErr.message });
        return NextResponse.json({ ok: false, message: 'Webhook persistence failed' }, { status: 500 });
      }
    } else if (existing.processed === true) {
      return NextResponse.json({ received: true, idempotent: true });
    }

    if (eventType === 'checkout.session.completed') {
      const session = payload as { id: string; payment_intent?: string | null; metadata?: Record<string, unknown> | null };

      const internalPaymentIdRaw = session.metadata?.internal_payment_id;
      const internalPaymentId =
        typeof internalPaymentIdRaw === 'string' && internalPaymentIdRaw.length > 0
          ? internalPaymentIdRaw
          : null;
      if (!internalPaymentId) {
        console.error('webhook:missing_internal_payment_id', { eventId, sessionId: session.id });
        return NextResponse.json({ ok: false, message: 'Missing internal payment id' }, { status: 400 });
      }

      const { data: payment, error: paymentReadErr } = await admin
        .from('payments_brand')
        .select('id, status, contest_id, brand_id')
        .eq('id', internalPaymentId)
        .single();
      if (paymentReadErr || !payment) {
        console.error('webhook:payment_not_found', { internalPaymentId, eventId, error: paymentReadErr?.message });
        return NextResponse.json({ ok: false, message: 'Payment not found for webhook event' }, { status: 404 });
      }

      if (payment.status === 'succeeded') {
        await admin
          .from('webhooks_stripe')
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq('stripe_event_id', eventId);
        return NextResponse.json({ received: true, idempotent: true });
      }

      const { error: updErr } = await admin
        .from('payments_brand')
        .update({
          status: 'succeeded',
          stripe_checkout_session_id: session.id,
          stripe_payment_intent_id: session.payment_intent || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', internalPaymentId);
      if (updErr) {
        console.error('webhook:payment_update_failed', { internalPaymentId, eventId, error: updErr.message });
        return NextResponse.json({ ok: false, message: 'Payment update failed' }, { status: 500 });
      }

      const contest_id = payment.contest_id ?? (session.metadata?.contest_id as string | undefined);
      const brand_id = payment.brand_id ?? (session.metadata?.brand_id as string | undefined);
      if (contest_id) {
        const { data: cRow, error: cReadErr } = await admin
          .from('contests')
          .select('status')
          .eq('id', contest_id)
          .single();
        if (cReadErr) {
          console.error('webhook:contest_read_failed', { contest_id, eventId, error: cReadErr.message });
          return NextResponse.json({ ok: false, message: 'Contest read failed' }, { status: 500 });
        }

        const oldStatus = cRow?.status ?? null;
        if (oldStatus !== 'active') {
          const { error: cUpd } = await admin
            .from('contests')
            .update({
              status: 'active',
              updated_at: new Date().toISOString(),
              ranking_frozen_at: new Date().toISOString(),
              // ranking_weights_snapshot already set when contest was created
            })
            .eq('id', contest_id);
          if (cUpd) {
            console.error('webhook:contest_activate_failed', { contest_id, eventId, error: cUpd.message });
            return NextResponse.json({ ok: false, message: 'Contest activation failed' }, { status: 500 });
          }

          await admin.from('status_history').insert({
            table_name: 'contests',
            row_id: contest_id,
            old_status: oldStatus,
            new_status: 'active',
            changed_by: brand_id ?? null,
          });
          await admin.from('audit_logs').insert({
            actor_id: brand_id ?? null,
            action: 'contest_publish_webhook',
            table_name: 'contests',
            row_pk: contest_id,
            old_values: { status: oldStatus },
            new_values: { status: 'active' },
          });

          const { data: contestDetails } = await admin
            .from('contests')
            .select('title, networks, brand_id')
            .eq('id', contest_id)
            .single();

          if (contestDetails) {
            const { notifyEligibleCreatorsAboutNewContest } = await import('@/lib/notifications');
            await notifyEligibleCreatorsAboutNewContest(
              contest_id,
              contestDetails.title,
              contestDetails.networks || [],
              admin
            );

            const { notifyBrandAboutContestActivation } = await import('@/lib/notifications');
            await notifyBrandAboutContestActivation(
              contestDetails.brand_id,
              contest_id,
              contestDetails.title,
              admin
            );
          }
        }
      }
    }

    const { error: markProcessedErr } = await admin
      .from('webhooks_stripe')
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq('stripe_event_id', eventId);
    if (markProcessedErr) {
      console.error('webhook:mark_processed_failed', { eventId, error: markProcessedErr.message });
      return NextResponse.json({ ok: false, message: 'Webhook finalize failed' }, { status: 500 });
    }

    return NextResponse.json({ received: true });
  } catch (e: unknown) {
    console.error('webhook:unhandled_error', e);
    const message = e instanceof Error ? e.message : 'Processing error';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
