import { NextResponse } from 'next/server';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { assertCsrf } from '@/lib/csrf';
import { enforceBrandRateLimit, BRAND_LIMIT_CRITICAL } from '@/lib/brand/rate-limit';
import { submissionValidators, type SubmissionRow } from '@/lib/brand/validators';

interface SubmissionWithContest extends SubmissionRow {
  id: string;
  contest_id: string;
  creator_id: string;
  contests: {
    brand_id: string;
  } | null;
}

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

  const { data: submission, error } = await supabase
    .from('submissions')
    .select(
      'id, status, contest_id, creator_id, contests!inner(brand_id)',
    )
    .eq('id', params.id)
    .maybeSingle<SubmissionWithContest>();

  if (error || !submission) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (!submission.contests || submission.contests.brand_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!submissionValidators.canApprove(submission)) {
    return NextResponse.json(
      { error: 'Already processed' },
      { status: 422 },
    );
  }

  const { error: updateError } = await supabase
    .from('submissions')
    .update({
      status: 'approved',
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id);

  if (updateError) {
    return NextResponse.json(
      { error: 'Update failed' },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}

