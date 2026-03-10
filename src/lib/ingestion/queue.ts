import { getSupabaseAdmin } from '@/lib/supabase/server';

export async function enqueueIngestionJob(
  submissionId: string,
  platform: string,
): Promise<number | null> {
  const admin = getSupabaseAdmin();

  const { data, error } = await admin
    .from('ingestion_jobs')
    .upsert(
      {
        submission_id: submissionId,
        account_id: null,
        kind: `metrics:${platform}`,
        scheduled_at: new Date().toISOString(),
        status: 'queued',
        attempts: 0,
      },
      {
        onConflict: 'submission_id,kind',
        ignoreDuplicates: false,
      },
    )
    .select('id')
    .single<{ id: number }>();

  if (error || !data) {
    console.error('[ingestion:queue] failed to enqueue', {
      submissionId,
      platform,
      error: error?.message,
    });
    return null;
  }

  console.log('[ingestion:queue] enqueued', {
    submissionId,
    platform,
    jobId: data.id,
  });
  return data.id;
}

export async function dequeueNextJob(): Promise<{
  id: number;
  submissionId: string;
  platform: string;
  videoUrl: string;
} | null> {
  const admin = getSupabaseAdmin();

  // Step 1: find next queued ingestion job
  const { data: jobs, error: jobsError } = await admin
    .from('ingestion_jobs')
    .select('id, submission_id, kind, attempts, status, scheduled_at')
    .eq('status', 'queued')
    .like('kind', 'metrics:%')
    .order('scheduled_at', { ascending: true })
    .limit(1);

  if (jobsError) {
    console.error('[ingestion:queue] failed to dequeue job', {
      error: jobsError.message,
    });
    return null;
  }

  const job = jobs?.[0] as
    | {
        id: number;
        submission_id: string | null;
        kind: string;
        attempts: number | null;
      }
    | undefined;

  if (!job || !job.submission_id) {
    return null;
  }

  // Step 2: fetch submission + contest
  const { data: submission, error: submissionError } = await admin
    .from('submissions')
    .select(
      'id, platform, external_url, status, contest:contests!inner(id, end_at, status)',
    )
    .eq('id', job.submission_id)
    .maybeSingle<{
      id: string;
      platform: string;
      external_url: string;
      status: string;
      contest?: { id: string; end_at: string | null; status?: string | null };
    }>();

  if (submissionError || !submission) {
    await admin
      .from('ingestion_jobs')
      .update({
        status: 'failed',
        last_error: 'SUBMISSION_INELIGIBLE',
        attempts: (job.attempts ?? 0) + 1,
      })
      .eq('id', job.id);
    return null;
  }

  const now = new Date();
  const contestEndAt = submission.contest?.end_at
    ? new Date(submission.contest.end_at)
    : null;

  const isApproved = submission.status === 'approved';
  const isContestActive =
    contestEndAt !== null &&
    contestEndAt.getTime() > now.getTime() &&
    submission.contest?.status === 'active';

  if (!isApproved || !isContestActive) {
    await admin
      .from('ingestion_jobs')
      .update({
        status: 'failed',
        last_error: 'SUBMISSION_INELIGIBLE',
        attempts: (job.attempts ?? 0) + 1,
      })
      .eq('id', job.id);
    return null;
  }

  return {
    id: job.id,
    submissionId: submission.id,
    platform: submission.platform,
    videoUrl: submission.external_url,
  };
}

