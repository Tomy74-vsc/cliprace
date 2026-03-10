import { getSupabaseAdmin } from '@/lib/supabase/server';
import { extractYoutubeId, fetchYoutubeMetrics } from './youtube';
import { fetchTiktokMetrics } from './tiktok';
import type {
  IngestionPlatform,
  IngestionResult,
  VideoMetrics,
} from './types';

interface DispatchParams {
  submissionId: string;
  platform: string;
  videoUrl: string;
  existingJobId?: number;
}

function normalizePlatform(value: string): IngestionPlatform | null {
  const v = value.toLowerCase() as IngestionPlatform | string;
  if (v === 'youtube' || v === 'tiktok' || v === 'instagram') {
    return v;
  }
  return null;
}

function extractErrorCode(error: unknown): string {
  const message =
    error instanceof Error ? error.message : String(error ?? '');

  if (message.includes('YOUTUBE_VIDEO_NOT_FOUND')) {
    return 'YOUTUBE_VIDEO_NOT_FOUND';
  }
  if (message.includes('YOUTUBE_INVALID_URL')) {
    return 'YOUTUBE_INVALID_URL';
  }
  if (message.includes('YOUTUBE_API_HTTP_ERROR')) {
    return 'YOUTUBE_API_HTTP_ERROR';
  }
  if (message.includes('TIKTOK_RATE_LIMIT')) {
    return 'TIKTOK_RATE_LIMIT';
  }
  if (message.includes('TIKTOK_VIDEO_UNAVAILABLE')) {
    return 'TIKTOK_VIDEO_UNAVAILABLE';
  }
  if (message.includes('TIKTOK_TIMEOUT')) {
    return 'TIKTOK_TIMEOUT';
  }
  if (message.includes('TIKTOK_API_HTTP_ERROR')) {
    return 'TIKTOK_API_HTTP_ERROR';
  }
  if (message.includes('PLATFORM_NOT_SUPPORTED')) {
    return 'PLATFORM_NOT_SUPPORTED';
  }
  return 'UNKNOWN_ERROR';
}

export async function dispatchIngestion(
  params: DispatchParams,
): Promise<IngestionResult> {
  const admin = getSupabaseAdmin();
  const platform = normalizePlatform(params.platform);

  if (!platform) {
    return {
      ok: false,
      submissionId: params.submissionId,
      platform: 'youtube',
      error: `PLATFORM_NOT_SUPPORTED: ${params.platform}`,
      errorCode: 'PLATFORM_NOT_SUPPORTED',
    };
  }

  let jobId: number | null = null;
  let attempts = 0;

  if (typeof params.existingJobId === 'number') {
    // Reuse existing job: mark as running and bump attempts
    const { data: existingJob, error: existingError } = await admin
      .from('ingestion_jobs')
      .select('id, attempts')
      .eq('id', params.existingJobId)
      .single<{ id: number; attempts: number | null }>();

    if (existingError || !existingJob) {
      const message =
        existingError?.message ?? 'Failed to load existing ingestion job row';
      const error = new Error(
        `INGESTION_JOB_LOAD_FAILED: ${message}`,
      );
      const errorCode = extractErrorCode(error);

      return {
        ok: false,
        submissionId: params.submissionId,
        platform,
        error: error.message,
        errorCode,
      };
    }

    attempts = (existingJob.attempts ?? 0) + 1;
    jobId = existingJob.id;

    await admin
      .from('ingestion_jobs')
      .update({
        status: 'running',
        attempts,
      })
      .eq('id', jobId);
  } else {
    // 1) Create ingestion_job row for direct dispatch
    const { data: job, error: jobError } = await admin
      .from('ingestion_jobs')
      .insert({
        submission_id: params.submissionId,
        account_id: null,
        kind: `metrics:${platform}`,
        scheduled_at: new Date().toISOString(),
        status: 'running',
        attempts: 1,
      })
      .select('id')
      .single<{ id: number }>();

    if (jobError || !job) {
      const message =
        jobError?.message ?? 'Failed to create ingestion job row';
      const error = new Error(
        `INGESTION_JOB_CREATE_FAILED: ${message}`,
      );
      const errorCode = extractErrorCode(error);

      return {
        ok: false,
        submissionId: params.submissionId,
        platform,
        error: error.message,
        errorCode,
      };
    }

    jobId = job.id;
    attempts = 1;
  }

  try {
    let metrics: VideoMetrics;

    switch (platform) {
      case 'youtube': {
        const videoId = extractYoutubeId(params.videoUrl);
        if (!videoId) {
          throw new Error('YOUTUBE_INVALID_URL');
        }
        metrics = await fetchYoutubeMetrics(videoId);
        break;
      }
      case 'tiktok': {
        metrics = await fetchTiktokMetrics(params.videoUrl);
        console.log('[ingestion:tiktok] success', {
          submissionId: params.submissionId,
          views: metrics.views,
          likes: metrics.likes,
        });
        break;
      }
      default: {
        throw new Error('PLATFORM_NOT_SUPPORTED');
      }
    }

    // 3a) Upsert metrics_daily for today
    const today = new Date().toISOString().slice(0, 10);
    const { error: upsertError } = await admin
      .from('metrics_daily')
      .upsert(
        {
          submission_id: params.submissionId,
          metric_date: today,
          views: metrics.views,
          likes: metrics.likes,
          comments: metrics.comments,
          shares: metrics.shares,
        },
        { onConflict: 'submission_id,metric_date' },
      );

    if (upsertError) {
      throw new Error(
        upsertError.message ??
          'Failed to upsert metrics_daily for submission',
      );
    }

    // 3b) Update job status to succeeded
    await admin
      .from('ingestion_jobs')
      .update({
        status: 'succeeded',
        last_error: null,
      })
      .eq('id', jobId);

    // 3c) Return success result
    return {
      ok: true,
      submissionId: params.submissionId,
      platform,
      metrics,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error ?? '');
    const errorCode = extractErrorCode(error);

    // 4a) Mark job as failed
    if (jobId !== null) {
      await admin
        .from('ingestion_jobs')
        .update({
          status: 'failed',
          last_error: message.slice(0, 500),
        })
        .eq('id', jobId);

      // 4b) Insert ingestion_error row
      await admin.from('ingestion_errors').insert({
        job_id: jobId,
        error_code: errorCode,
        details: {
          message,
          videoUrl: params.videoUrl,
          platform,
        },
      });
    }

    // 4c) Return failure result
    return {
      ok: false,
      submissionId: params.submissionId,
      platform,
      error: message,
      errorCode,
    };
  }
}

