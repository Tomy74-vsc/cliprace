import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getPlatformToken } from '@/lib/oauth/get-platform-token';
import type { OAuthPlatform } from '@/lib/oauth/platforms';
import {
  extractYouTubeVideoId,
  extractTikTokVideoId,
  extractInstagramMediaId,
} from './extract-video-id';
import {
  fetchYouTubeMetrics,
  fetchTikTokMetrics,
  fetchInstagramMetrics,
  type VideoMetrics,
  PlatformApiError,
} from './platform-fetchers';

type Submission = {
  id: string;
  contest_id: string;
  creator_id: string;
  platform: string;
  external_url: string;
};

type IngestResult =
  | { ok: true; metrics: VideoMetrics }
  | { ok: false; error: string; code: string };

function normalizePlatform(value: string): OAuthPlatform | null {
  const v = value.toLowerCase();
  if (v === 'youtube' || v === 'tiktok' || v === 'instagram') {
    return v;
  }
  return null;
}
export async function ingestSubmissionWithAudit(
  submission: Submission,
): Promise<IngestResult> {
  const platform = normalizePlatform(submission.platform);
  if (!platform) {
    return {
      ok: false,
      code: 'UNSUPPORTED_PLATFORM',
      error: `Plateforme non supportée: ${submission.platform}`,
    };
  }

  let idResult:
    | ReturnType<typeof extractYouTubeVideoId>
    | ReturnType<typeof extractTikTokVideoId>
    | ReturnType<typeof extractInstagramMediaId>;

  if (platform === 'youtube') {
    idResult = extractYouTubeVideoId(submission.external_url);
  } else if (platform === 'tiktok') {
    idResult = extractTikTokVideoId(submission.external_url);
  } else {
    idResult = extractInstagramMediaId(submission.external_url);
  }

  if (!idResult.ok) {
    return { ok: false, code: 'INVALID_URL', error: idResult.error };
  }

  const videoId = idResult.videoId;

  const accessToken = await getPlatformToken(submission.creator_id, platform);
  if (!accessToken) {
    return {
      ok: false,
      code: 'NO_TOKEN',
      error: 'Aucun token OAuth disponible pour cette plateforme',
    };
  }

  let metrics: VideoMetrics;
  try {
    if (platform === 'youtube') {
      metrics = await fetchYouTubeMetrics(videoId, accessToken);
    } else if (platform === 'tiktok') {
      metrics = await fetchTikTokMetrics(videoId, accessToken);
    } else {
      metrics = await fetchInstagramMetrics(videoId, accessToken);
    }
  } catch (error) {
    if (error instanceof PlatformApiError) {
      return {
        ok: false,
        code: error.code,
        error: error.message,
      };
    }
    return {
      ok: false,
      code: 'API_ERROR',
      error: error instanceof Error ? error.message : 'Erreur API inconnue',
    };
  }

  const weightedViews = metrics.views * 1.0;
  const admin = getSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const method = 'platform_oauth';
  const confidence = 0.95;

  try {
    const { error: upsertError } = await admin
      .from('metrics_daily')
      .upsert(
        {
          submission_id: submission.id,
          metric_date: today,
          views: metrics.views,
          likes: metrics.likes,
          comments: metrics.comments,
          shares: metrics.shares,
          weighted_views: weightedViews,
          method,
          confidence,
          formula_version: 1,
          weights_snapshot: {
            w_platform: 1.0,
            w_like: 0.5,
            w_comment: 0.3,
            w_share: 0.4,
          },
          collected_at: new Date().toISOString(),
          collected_by: 'trigger.dev',
        },
        { onConflict: 'submission_id,metric_date' },
      );

    if (upsertError) {
      return {
        ok: false,
        code: 'DB_ERROR',
        error: upsertError.message ?? 'Erreur lors de la sauvegarde des métriques',
      };
    }

    return { ok: true, metrics };
  } catch (error) {
    return {
      ok: false,
      code: 'DB_ERROR',
      error: error instanceof Error ? error.message : 'Erreur base de données inconnue',
    };
  }
}

export async function ingestSubmission(submission: Submission): Promise<IngestResult> {
  return ingestSubmissionWithAudit(submission);
}

export type { Submission, IngestResult };

