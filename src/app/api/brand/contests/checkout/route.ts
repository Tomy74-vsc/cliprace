import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assertCsrf } from '@/lib/csrf';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { enforceBrandRateLimit, BRAND_LIMIT_CRITICAL } from '@/lib/brand/rate-limit';
import { getStripe } from '@/lib/stripe';

const checkoutSchema = z
  .object({
    title: z.string().min(5).max(120),
    briefMd: z.string().min(20).max(5000),
    networks: z.array(z.enum(['tiktok', 'instagram', 'youtube', 'twitter'])).min(1),
    budgetCents: z.number().min(10_000),
    prizePoolCents: z.number().min(5_000),
    currency: z.enum(['EUR', 'USD']),
    maxWinners: z.number().int().min(1).max(100),
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
    coverUrl: z.string().url().nullable().optional(),
  })
  .refine((d) => d.prizePoolCents <= d.budgetCents, {
    message: 'Prize pool cannot exceed budget',
    path: ['prizePoolCents'],
  });

function slugifyTitle(title: string) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 40)
    .replace(/^-|-$/g, '');
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

export async function POST(req: Request) {
  const supabase = await getSupabaseSSR();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cookieHeader = req.headers.get('cookie');
  const csrfHeader = req.headers.get('x-csrf');
  try {
    assertCsrf(cookieHeader, csrfHeader, user.id);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 400 },
    );
  }

  await enforceBrandRateLimit(req, user.id, BRAND_LIMIT_CRITICAL);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const {
    title,
    briefMd,
    networks,
    budgetCents,
    prizePoolCents,
    currency,
    maxWinners,
    startAt,
    endAt,
    coverUrl,
  } = parsed.data;

  const start = new Date(startAt);
  const end = new Date(endAt);
  if (end <= start) {
    return NextResponse.json(
      { error: 'End date must be after start date' },
      { status: 422 },
    );
  }

  const { data: contest, error: contestErr } = await supabase
    .from('contests')
    .insert({
      brand_id: user.id,
      title,
      slug: slugifyTitle(title),
      brief_md: briefMd,
      networks,
      budget_cents: budgetCents,
      prize_pool_cents: prizePoolCents,
      currency,
      max_winners: maxWinners,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      cover_url: coverUrl ?? null,
      status: 'draft',
      ranking_formula_version: 1,
      ranking_weights_snapshot: {
        w_platform: 1.0,
        w_like: 0.5,
        w_comment: 0.3,
        w_share: 0.4,
      },
    })
    .select('id, title')
    .single();

  if (contestErr || !contest) {
    return NextResponse.json({ error: 'Contest creation failed' }, { status: 500 });
  }

  const { data: payment, error: paymentErr } = await supabase
    .from('payments_brand')
    .insert({
      brand_id: user.id,
      contest_id: contest.id,
      amount_cents: budgetCents,
      currency,
      status: 'requires_payment',
    })
    .select('id')
    .single();

  if (paymentErr || !payment) {
    await supabase.from('contests').delete().eq('id', contest.id);
    return NextResponse.json(
      { error: 'Payment record creation failed' },
      { status: 500 },
    );
  }

  const stripe = getStripe();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: `ClipRace — ${title}`,
              description: `Contest budget: ${(budgetCents / 100).toFixed(2)} ${currency}`,
            },
            unit_amount: budgetCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        internal_payment_id: payment.id,
        contest_id: contest.id,
        brand_id: user.id,
      },
      success_url: `${appUrl}/app/brand/contests/${contest.id}?payment=success`,
      cancel_url: `${appUrl}/app/brand/contests/new?payment=cancelled`,
    });

    return NextResponse.json({
      success: true,
      checkoutUrl: session.url,
      contestId: contest.id,
    });
  } catch (stripeErr) {
    await supabase.from('payments_brand').delete().eq('id', payment.id);
    await supabase.from('contests').delete().eq('id', contest.id);
    const msg =
      stripeErr instanceof Error ? stripeErr.message : 'Stripe error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

