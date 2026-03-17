import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { assertCsrf } from '@/lib/csrf';
import { enforceBrandRateLimit, BRAND_LIMIT_STANDARD } from '@/lib/brand/rate-limit';

const updateContestSchema = z.object({
  title: z.string().min(3).max(120).optional(),
  briefMd: z.string().max(5000).optional(),
  endAt: z.string().datetime().optional(),
  maxWinners: z.number().int().min(1).max(100).optional(),
  networks: z.array(z.string()).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
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

  await enforceBrandRateLimit(req, user.id, BRAND_LIMIT_STANDARD);

  const body = await req.json().catch(() => null);
  const parsed = updateContestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { data: contest, error } = await supabase
    .from('contests')
    .select('id, brand_id, status')
    .eq('id', params.id)
    .maybeSingle<{ id: string; brand_id: string; status: string }>();

  if (error || !contest) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (contest.brand_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!['draft', 'paused'].includes(contest.status)) {
    return NextResponse.json(
      { error: 'Cannot edit active or ended contest' },
      { status: 422 },
    );
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (parsed.data.title !== undefined) {
    updates.title = parsed.data.title;
  }
  if (parsed.data.briefMd !== undefined) {
    updates.brief_md = parsed.data.briefMd;
  }
  if (parsed.data.endAt !== undefined) {
    updates.end_at = parsed.data.endAt;
  }
  if (parsed.data.maxWinners !== undefined) {
    updates.max_winners = parsed.data.maxWinners;
  }
  if (parsed.data.networks !== undefined) {
    updates.networks = parsed.data.networks;
  }

  const { data: updated, error: updateError } = await supabase
    .from('contests')
    .update(updates)
    .eq('id', params.id)
    .select('id, title, status, updated_at')
    .maybeSingle();

  if (updateError || !updated) {
    return NextResponse.json(
      { error: 'Update failed' },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, contest: updated });
}

