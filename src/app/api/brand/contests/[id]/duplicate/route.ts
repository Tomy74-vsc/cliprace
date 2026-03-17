import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { assertCsrf } from '@/lib/csrf';
import { enforceBrandRateLimit, BRAND_LIMIT_CRITICAL } from '@/lib/brand/rate-limit';
import { contestValidators, type ContestRow } from '@/lib/brand/validators';

export async function POST(req: Request, { params }: { params: { id: string } }) {
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

  const { data: contest, error } = await supabase
    .from('contests')
    .select(
      'id, brand_id, title, status, brief_md, cover_url, networks, budget_cents, prize_pool_cents, currency, max_winners',
    )
    .eq('id', params.id)
    .maybeSingle<
      ContestRow & {
        id: string;
        brand_id: string;
        title: string;
        brief_md: string | null;
        cover_url: string | null;
        networks: string[] | null;
        prize_pool_cents: number;
        currency: string | null;
        max_winners: number | null;
      }
    >();

  if (error || !contest) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (contest.brand_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!contestValidators.canDuplicate(contest)) {
    return NextResponse.json(
      { error: 'Invalid status for duplication' },
      { status: 422 },
    );
  }

  const baseSlug = contest.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

  const slug = `${baseSlug}-${randomUUID().slice(0, 6)}`;

  const now = Date.now();
  const startAt = new Date(now + 7 * 86_400_000).toISOString();
  const endAt = new Date(now + 37 * 86_400_000).toISOString();

  const { data: inserted, error: insertError } = await supabase
    .from('contests')
    .insert({
      brand_id: contest.brand_id,
      title: `${contest.title} (copy)`,
      slug,
      brief_md: contest.brief_md,
      cover_url: contest.cover_url,
      status: 'draft',
      budget_cents: contest.budget_cents,
      prize_pool_cents: contest.prize_pool_cents,
      currency: contest.currency ?? 'EUR',
      start_at: startAt,
      end_at: endAt,
      networks: contest.networks ?? [],
      max_winners: contest.max_winners ?? 1,
    })
    .select('id')
    .maybeSingle();

  if (insertError || !inserted) {
    return NextResponse.json(
      { error: 'Duplicate failed' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    contestId: inserted.id,
  });
}

