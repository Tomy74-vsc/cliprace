import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { assertCsrf } from '@/lib/csrf';
import { enforceBrandRateLimit, BRAND_LIMIT_CRITICAL } from '@/lib/brand/rate-limit';
import { submissionValidators, type SubmissionRow } from '@/lib/brand/validators';

const rejectBodySchema = z.object({
  reason: z.string().min(10).max(500),
});

interface SubmissionWithContest extends SubmissionRow {
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

  const body = await req.json().catch(() => null);
  const parsed = rejectBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 422 },
    );
  }

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

  if (!submissionValidators.canReject(submission)) {
    return NextResponse.json(
      { error: 'Already processed' },
      { status: 422 },
    );
  }

  const { error: updateError } = await supabase
    .from('submissions')
    .update({
      status: 'rejected',
      rejection_reason: parsed.data.reason,
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

