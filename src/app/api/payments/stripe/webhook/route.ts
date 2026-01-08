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

  // Idempotency: record event
  const eventId = evt.id as string;
  const eventType = evt.type as string;
  const payload = evt.data?.object ?? {};

  const { data: existing } = await admin
    .from('webhooks_stripe')
    .select('id, processed')
    .eq('stripe_event_id', eventId)
    .maybeSingle();
  if (!existing) {
    await admin.from('webhooks_stripe').insert({
      stripe_event_id: eventId,
      event_type: eventType,
      payload,
      processed: false,
    });
  } else if (existing.processed === true) {
    // Already processed — acknowledge to make Stripe stop retries
    return NextResponse.json({ received: true, idempotent: true });
  }

  // Process specific events
  try {
    if (eventType === 'checkout.session.completed') {
      const session = payload as { id: string; payment_intent?: string; metadata?: Record<string, unknown> };
      // Mark payment succeeded
      const { error: updErr } = await admin
        .from('payments_brand')
        .update({
          status: 'succeeded',
          stripe_checkout_session_id: session.id,
          stripe_payment_intent_id: session.payment_intent || null,
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_checkout_session_id', session.id)
        .select('id')
        .single();
      if (updErr) throw new Error(updErr.message);

      // Note: La facture sera générée à la demande lors du premier téléchargement
      // via /api/invoices/[payment_id]/download qui appelle generate si nécessaire
      // Cela évite les problèmes de timeout et de dépendances dans le webhook

      // Auto-publish contest if possible (activation rule)
      const contest_id = session.metadata?.contest_id as string | undefined;
      const brand_id = session.metadata?.brand_id as string | undefined;
      if (contest_id) {
        // Set contest active and log history/audit
        // Load old status
        const { data: cRow } = await admin
          .from('contests')
          .select('status')
          .eq('id', contest_id)
          .single();
        const oldStatus = cRow?.status ?? null;
        const { error: cUpd } = await admin
          .from('contests')
          .update({ status: 'active', updated_at: new Date().toISOString() })
          .eq('id', contest_id);
        if (!cUpd) {
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

          // Récupérer les détails du concours pour les notifications
          const { data: contestDetails } = await admin
            .from('contests')
            .select('title, networks, brand_id')
            .eq('id', contest_id)
            .single();

          if (contestDetails) {
            // Notifier les créateurs éligibles
            const { notifyEligibleCreatorsAboutNewContest } = await import('@/lib/notifications');
            await notifyEligibleCreatorsAboutNewContest(
              contest_id,
              contestDetails.title,
              contestDetails.networks || [],
              admin
            );

            // Notifier la marque
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

    // Optionally handle refunds/failed here as needed

    // Mark processed
    await admin
      .from('webhooks_stripe')
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq('stripe_event_id', eventId);

    return NextResponse.json({ received: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Processing error';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
