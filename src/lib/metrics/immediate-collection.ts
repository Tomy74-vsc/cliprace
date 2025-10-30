/**
 * Immediate Metrics Collection
 * 
 * Triggers metrics collection immediately after video submission
 * to get initial metrics and start the monitoring process
 */

import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { fetchVideoMetrics as fetchYouTubeMetrics, getYouTubeConfig } from '@/services/connectors/youtube';
import { fetchVideoMetrics as fetchTikTokMetrics, getTikTokConfig } from '@/services/connectors/tiktok';
import { fetchVideoMetrics as fetchInstagramMetrics, getInstagramConfig } from '@/services/connectors/instagram';

export interface ImmediateMetricsResult {
  success: boolean;
  metrics?: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    duration_seconds: number;
  };
  error?: string;
}

/**
 * Collect metrics immediately after submission
 */
export async function collectImmediateMetrics(
  submissionId: string,
  platformVideoId: string,
  platform: string,
  creatorId: string
): Promise<ImmediateMetricsResult> {
  try {
    logger.info(`Starting immediate metrics collection for submission ${submissionId}`, {
      platform,
      platformVideoId,
      creatorId,
    });

    let metrics;

    switch (platform) {
      case 'youtube':
        const youtubeConfig = await getYouTubeConfig(creatorId);
        const youtubeMetrics = await fetchYouTubeMetrics(platformVideoId, youtubeConfig);
        metrics = {
          views: youtubeMetrics.views,
          likes: youtubeMetrics.likes,
          comments: youtubeMetrics.comments,
          shares: 0, // YouTube doesn't provide shares in basic API
          duration_seconds: youtubeMetrics.duration_seconds,
        };
        break;

      case 'tiktok':
        const tiktokConfig = await getTikTokConfig(creatorId);
        const tiktokMetrics = await fetchTikTokMetrics(platformVideoId, tiktokConfig);
        metrics = {
          views: tiktokMetrics.views,
          likes: tiktokMetrics.likes,
          comments: tiktokMetrics.comments,
          shares: tiktokMetrics.shares,
          duration_seconds: tiktokMetrics.duration_seconds,
        };
        break;

      case 'instagram':
        const instagramConfig = await getInstagramConfig(creatorId);
        const instagramMetrics = await fetchInstagramMetrics(platformVideoId, instagramConfig);
        metrics = {
          views: instagramMetrics.views,
          likes: instagramMetrics.likes,
          comments: instagramMetrics.comments,
          shares: instagramMetrics.shares,
          duration_seconds: instagramMetrics.duration_seconds,
        };
        break;

      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }

    // Update submission with initial metrics
    await updateSubmissionWithMetrics(submissionId, metrics);

    // Store initial daily metrics
    await storeInitialDailyMetrics(submissionId, metrics);

    logger.info(`Immediate metrics collection completed for submission ${submissionId}`, {
      platform,
      metrics,
    });

    return {
      success: true,
      metrics,
    };

  } catch (error) {
    logger.error(`Immediate metrics collection failed for submission ${submissionId}`, error instanceof Error ? error : new Error('Unknown error'), {
      platform,
      submissionId,
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Update submission with initial metrics
 */
async function updateSubmissionWithMetrics(
  submissionId: string,
  metrics: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    duration_seconds: number;
  }
): Promise<void> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const engagementRate = calculateEngagementRate(metrics);

  const { error } = await supabase
    .from('submissions')
    .update({
      views: metrics.views,
      likes: metrics.likes,
      comments: metrics.comments,
      shares: metrics.shares,
      engagement_rate: engagementRate,
      last_metrics_fetch: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', submissionId);

  if (error) {
    throw new Error(`Failed to update submission metrics: ${error.message}`);
  }
}

/**
 * Store initial daily metrics
 */
async function storeInitialDailyMetrics(
  submissionId: string,
  metrics: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    duration_seconds: number;
  }
): Promise<void> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const today = new Date().toISOString().split('T')[0];
  const engagementRate = calculateEngagementRate(metrics);

  const { error } = await supabase
    .from('metrics_daily')
    .upsert({
      submission_id: submissionId,
      date: today,
      views: metrics.views,
      likes: metrics.likes,
      comments: metrics.comments,
      shares: metrics.shares,
      engagement_rate: engagementRate,
      views_change: 0,
      likes_change: 0,
      comments_change: 0,
      shares_change: 0,
    }, {
      onConflict: 'submission_id,date',
    });

  if (error) {
    throw new Error(`Failed to store initial daily metrics: ${error.message}`);
  }
}

/**
 * Calculate engagement rate
 */
function calculateEngagementRate(metrics: {
  views: number;
  likes: number;
  comments: number;
  shares: number;
}): number {
  if (metrics.views === 0) return 0;
  
  const totalEngagement = metrics.likes + metrics.comments + metrics.shares;
  return Math.round((totalEngagement / metrics.views) * 100 * 100) / 100; // Round to 2 decimal places
}
