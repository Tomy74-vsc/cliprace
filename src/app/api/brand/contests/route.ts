import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assertCsrf } from '@/lib/csrf';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { enforceBrandRateLimit, BRAND_LIMIT_CRITICAL } from '@/lib/brand/rate-limit';

const createContestSchema = z
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
    publish: z.boolean(),
  })
  .refine((data) => data.prizePoolCents <= data.budgetCents, {
    message: 'Prize pool cannot exceed budget',
    path: ['prizePoolCents'],
  });

function slugifyTitle(title: string) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 40)
    .replace(/^-|-$/g, '');
  const suffix = crypto.randomUUID().slice(0, 6);
  return `${base}-${suffix}`;
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
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    );
  }

  await enforceBrandRateLimit(req, user.id, BRAND_LIMIT_CRITICAL);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = createContestSchema.safeParse(body);
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
    publish,
  } = parsed.data;

  const start = new Date(startAt);
  const end = new Date(endAt);
  if (!(start instanceof Date && !Number.isNaN(start.getTime()))) {
    return NextResponse.json(
      { error: 'Invalid start date' },
      { status: 422 },
    );
  }
  if (!(end instanceof Date && !Number.isNaN(end.getTime()))) {
    return NextResponse.json(
      { error: 'Invalid end date' },
      { status: 422 },
    );
  }
  if (end <= start) {
    return NextResponse.json(
      { error: 'End date must be after start date' },
      { status: 422 },
    );
  }

  const slug = slugifyTitle(title);

  const { data, error } = await supabase
    .from('contests')
    .insert({
      brand_id: user.id,
      title,
      slug,
      brief_md: briefMd,
      networks,
      budget_cents: budgetCents,
      prize_pool_cents: prizePoolCents,
      currency,
      max_winners: maxWinners,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      cover_url: coverUrl ?? null,
      status: publish ? 'active' : 'draft',
    })
    .select('id, slug, status')
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { error: 'Creation failed' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    contestId: data.id,
    status: data.status,
    slug: data.slug,
  });
}

