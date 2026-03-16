/*
 * GET /api/payments/creator/onboarding
 * Returns Stripe Connect Express onboarding URL for the current creator.
 * Creates a Connect account if needed and stores stripe_account_id in profiles.
 */
import { NextResponse } from 'next/server';
import { assertCsrf } from '@/lib/csrf';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getUserRole } from '@/lib/auth';
import { getStripe } from '@/lib/stripe';

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

export async function POST(req: Request) {
  try {
    const cookieHeader = req.headers.get('cookie');
    const csrfHeader = req.headers.get('x-csrf');
    try {
      assertCsrf(cookieHeader, csrfHeader);
    } catch (e) {
      return NextResponse.json(
        { error: (e as Error).message },
        { status: 400 },
      );
    }
    const supabase = await getSupabaseSSR();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const role = await getUserRole(user.id);
    if (role !== 'creator' && role !== 'admin') {
      return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
    }

    const admin = getSupabaseAdmin();
    const { data: profile } = await admin
      .from('profiles')
      .select('stripe_account_id')
      .eq('id', user.id)
      .single();

    const stripe = getStripe();
    let accountId = (profile as { stripe_account_id?: string | null } | null)?.stripe_account_id ?? null;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'FR',
      });
      accountId = account.id;
      await admin
        .from('profiles')
        .update({
          stripe_account_id: accountId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
    }

    const returnUrl = `${BASE_URL}/app/creator/wallet?onboarding=complete`;
    const refreshUrl = `${BASE_URL}/app/creator/wallet?onboarding=refresh`;

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    return NextResponse.json({ ok: true, url: link.url });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Server error';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
