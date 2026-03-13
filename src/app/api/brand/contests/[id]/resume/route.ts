import { NextResponse } from 'next/server';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { assertCsrf } from '@/lib/csrf';
import { enforceBrandRateLimit, BRAND_LIMIT_CRITICAL } from '@/lib/brand/rate-limit';
import { contestValidators, type ContestRow } from '@/lib/brand/validators';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const cookieHeader = req.headers.get('cookie');
  const csrfHeader = req.headers.get('x-csrf');

  try {
    assertCsrf(cookieHeader, csrfHeader);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    );
  }

  const supabase = await getSupabaseSSR();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await enforceBrandRateLimit(req, user.id, BRAND_LIMIT_CRITICAL);

  const { data: contest, error } = await supabase
    .from('contests')
    .select('id, brand_id, status, budget_cents')
    .eq('id', params.id)
    .maybeSingle<ContestRow & { id: string; brand_id: string }>();

  if (error || !contest) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (contest.brand_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!contestValidators.canResume(contest)) {
    return NextResponse.json(
      { error: 'Invalid status transition' },
      { status: 422 },
    );
  }

  const { data: updated, error: updateError } = await supabase
    .from('contests')
    .update({
      status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .select('id, status')
    .maybeSingle();

  if (updateError || !updated) {
    return NextResponse.json(
      { error: 'Update failed' },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, contest: updated });
}

