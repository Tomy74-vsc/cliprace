import { NextResponse } from 'next/server';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { assertCsrf } from '@/lib/csrf';
import { enforceBrandRateLimit, BRAND_LIMIT_CRITICAL } from '@/lib/brand/rate-limit';

interface SubmissionWithContestAndCreator {
  id: string;
  contest_id: string;
  creator_id: string;
  contests: {
    brand_id: string;
  } | null;
}

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

  const { data: submission, error } = await supabase
    .from('submissions')
    .select(
      'id, contest_id, creator_id, contests!inner(brand_id)',
    )
    .eq('id', params.id)
    .maybeSingle<SubmissionWithContestAndCreator>();

  if (error || !submission) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (!submission.contests || submission.contests.brand_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: existingThread, error: threadError } = await supabase
    .from('message_threads')
    .select('id')
    .eq('brand_id', user.id)
    .eq('creator_id', submission.creator_id)
    .eq('contest_id', submission.contest_id)
    .maybeSingle<{ id: string }>();

  if (threadError && threadError.code !== 'PGRST116') {
    return NextResponse.json(
      { error: 'Thread lookup failed' },
      { status: 500 },
    );
  }

  if (existingThread) {
    return NextResponse.json({ success: true, threadId: existingThread.id });
  }

  const { data: upserted, error: upsertError } = await supabase
    .from('message_threads')
    .upsert(
      {
        brand_id: user.id,
        creator_id: submission.creator_id,
        contest_id: submission.contest_id,
      },
      { onConflict: 'brand_id,creator_id,contest_id' },
    )
    .select('id')
    .maybeSingle<{ id: string }>();

  if (upsertError || !upserted) {
    return NextResponse.json(
      { error: 'Thread creation failed' },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, threadId: upserted.id });
}

