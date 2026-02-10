/*
 * GET /api/payments/creator/onboarding/status
 * Syncs stripe_details_submitted from Stripe and returns { stripeConnected: boolean }.
 * Call after return from Stripe onboarding (e.g. wallet?onboarding=complete).
 */
import { NextResponse } from 'next/server';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getUserRole } from '@/lib/auth';
import { getStripe } from '@/lib/stripe';

export async function GET() {
  try {
    const supabase = await getSupabaseSSR();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, stripeConnected: false }, { status: 401 });
    }

    const role = await getUserRole(user.id);
    if (role !== 'creator' && role !== 'admin') {
      return NextResponse.json({ ok: false, stripeConnected: false }, { status: 403 });
    }

    const admin = getSupabaseAdmin();
    const { data: profile } = await admin
      .from('profiles')
      .select('stripe_account_id, stripe_details_submitted')
      .eq('id', user.id)
      .single();

    const accountId = (profile as { stripe_account_id?: string | null } | null)?.stripe_account_id;
    if (!accountId) {
      return NextResponse.json({ ok: true, stripeConnected: false });
    }

    const stripe = getStripe();
    const account = await stripe.accounts.retrieve(accountId);
    const detailsSubmitted = account.details_submitted === true;

    if (detailsSubmitted) {
      await admin
        .from('profiles')
        .update({
          stripe_details_submitted: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
    }

    return NextResponse.json({
      ok: true,
      stripeConnected: detailsSubmitted,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Server error';
    return NextResponse.json({ ok: false, stripeConnected: false, message }, { status: 500 });
  }
}
