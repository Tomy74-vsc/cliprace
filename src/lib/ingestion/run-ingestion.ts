import { getSupabaseAdmin } from '@/lib/supabase/server';
import type { Submission, IngestResult } from './ingest-submission';
import { ingestSubmission } from './ingest-submission';

export type Platform = 'youtube' | 'tiktok' | 'instagram';

type IngestionReport = {
  platform: Platform;
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  errors: Array<{ submission_id: string; code: string; error: string }>;
};

type DbSubmissionRow = {
  id: string;
  contest_id: string;
  creator_id: string;
  platform: string;
  external_url: string;
};

async function getPlatformAccountId(
  admin: ReturnType<typeof getSupabaseAdmin>,
  submission: Submission,
): Promise<string | null> {
  try {
    const { data, error } = await admin
      .from('platform_accounts')
      .select('id')
      .eq('user_id', submission.creator_id)
      .eq('platform', submission.platform)
      .maybeSingle<{ id: string }>();

    if (error || !data) {
      return null;
    }
    return data.id;
  } catch {
    return null;
  }
}

async function logJob(
  admin: ReturnType<typeof getSupabaseAdmin>,
  submission: Submission,
  platform: Platform,
  result: IngestResult,
): Promise<void> {
  try {
    const accountId = await getPlatformAccountId(admin, submission);
    if (!accountId) return;

    if (result.ok) {
      await admin.from('ingestion_jobs').insert({
        account_id: accountId,
        kind: `metrics_${platform}`,
        scheduled_at: new Date().toISOString(),
        status: 'succeeded',
        attempts: 1,
        last_error: null,
      });
      return;
    }

    // NO_TOKEN est considéré comme "skipped" sans log d'erreur
    if (result.code === 'NO_TOKEN') {
      return;
    }

    const { data: job, error: jobError } = await admin
      .from('ingestion_jobs')
      .insert({
        account_id: accountId,
        kind: `metrics_${platform}`,
        scheduled_at: new Date().toISOString(),
        status: 'failed',
        attempts: 1,
        last_error: result.error.slice(0, 500),
      })
      .select('id')
      .single<{ id: number }>();

    if (jobError || !job) {
      return;
    }

    await admin.from('ingestion_errors').insert({
      job_id: job.id,
      error_code: result.code,
      details: {
        submission_id: submission.id,
        contest_id: submission.contest_id,
        platform: submission.platform,
        message: result.error,
      },
    });
  } catch (error) {
    console.error('runIngestion: failed to log ingestion job/error', error);
  }
}

export async function runIngestion(platform: Platform): Promise<IngestionReport> {
  const admin = getSupabaseAdmin();

  const { data, error } = await admin
    .from('submissions')
    .select(
      'id, contest_id, creator_id, platform, external_url, contest:contests!inner(status)',
    )
    .in('status', ['pending', 'approved'])
    .eq('platform', platform)
    .eq('contest.status', 'active')
    .limit(500);

  if (error) {
    throw new Error(
      error.message || 'Erreur lors du chargement des soumissions à ingérer',
    );
  }

  const rows = (data ?? []) as Array<
    DbSubmissionRow & { contest?: { status?: string } }
  >;

  const report: IngestionReport = {
    platform,
    total: rows.length,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  for (const row of rows) {
    const submission: Submission = {
      id: row.id,
      contest_id: row.contest_id,
      creator_id: row.creator_id,
      platform: row.platform,
      external_url: row.external_url,
    };

    const result = await ingestSubmission(submission);

    if (result.ok) {
      report.succeeded += 1;
    } else if (result.code === 'NO_TOKEN') {
      report.skipped += 1;
    } else {
      report.failed += 1;
      report.errors.push({
        submission_id: submission.id,
        code: result.code,
        error: result.error,
      });
    }

    await logJob(admin, submission, platform, result);
  }

  return report;
}

export type { IngestionReport };

