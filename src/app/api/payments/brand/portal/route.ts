import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getUserRole } from '@/lib/auth';
import { getStripe } from '@/lib/stripe';
import { rateLimit } from '@/lib/rateLimit';
import { buildRateLimitKey } from '@/lib/safe-ip';

type ProfileStripeRow = {
  stripe_customer_id?: string | null;
} | null;

function getBaseUrl(req: NextRequest): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.APP_URL ||
    req.nextUrl.origin ||
    'http://localhost:3000'
  );
}

function normalizeStripeCustomerId(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export async function GET(req: NextRequest) {
  try {
    const supabaseSSR = await getSupabaseSSR();
    const {
      data: { user },
    } = await supabaseSSR.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const role = await getUserRole(user.id);
    if (role !== 'brand' && role !== 'admin') {
      return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
    }

    const rlKey = buildRateLimitKey('payments:brand:portal', user.id, req);
    const allowed = await rateLimit({
      key: rlKey,
      route: 'payments:brand:portal',
      windowMs: 60_000,
      max: 10,
    });
    if (!allowed) {
      return NextResponse.json({ ok: false, message: 'Rate limit exceeded' }, { status: 429 });
    }

    const admin = getSupabaseAdmin();

    let stripeCustomerId: string | null = null;
    const profileRes = await admin
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle();

    if (profileRes.error) {
      const maybeCode = String((profileRes.error as UnsafeAny).code || '');
      if (maybeCode !== '42703') {
        console.error('billing_portal:profile_lookup_error', profileRes.error);
        return NextResponse.json({ ok: false, message: 'Unable to load billing profile' }, { status: 500 });
      }
    } else {
      stripeCustomerId = normalizeStripeCustomerId((profileRes.data as ProfileStripeRow)?.stripe_customer_id);
    }

    if (!stripeCustomerId) {
      const { data: payment, error: paymentError } = await admin
        .from('payments_brand')
        .select('stripe_customer_id')
        .eq('brand_id', user.id)
        .not('stripe_customer_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (paymentError) {
        console.error('billing_portal:payment_lookup_error', paymentError);
        return NextResponse.json({ ok: false, message: 'Unable to load billing history' }, { status: 500 });
      }

      stripeCustomerId = normalizeStripeCustomerId((payment as UnsafeAny)?.stripe_customer_id);
    }

    if (!stripeCustomerId) {
      return NextResponse.json(
        { ok: false, message: 'Aucun historique de paiement. Effectuez un premier paiement pour activer la facturation.' },
        { status: 409 }
      );
    }

    const stripe = getStripe();
    const returnUrl = `${getBaseUrl(req)}/app/brand/billing`;
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    });

    return NextResponse.json({ ok: true, url: session.url });
  } catch (error) {
    console.error('billing_portal:unexpected_error', error);
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
