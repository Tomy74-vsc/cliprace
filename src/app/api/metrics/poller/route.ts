/**
 * Manual Metrics Poller Endpoint
 * 
 * Triggers the metrics poller manually
 * Can be called via cron job or manual trigger
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import pLimit from 'p-limit';
import { fetchVideoMetrics, getYouTubeConfig } from '@/services/connectors/youtube';
import { logger, PerformanceMonitor } from '@/lib/logger';
import { 
  SubmissionToProcess, 
  MetricsResult, 
  MetricsConfig 
} from '@/lib/supabase/types';

// Optimized configuration
const METRICS_CONFIG: MetricsConfig = {
  rateLimits: {
    youtube: 5,
    tiktok: 3,
    instagram: 3,
  },
  refreshIntervals: {
    youtube: 5,
    tiktok: 10,
    instagram: 15,
  },
  batchSize: 50,
  maxRetries: 3,
  retryDelay: 1000,
};

/**
 * GET handler - Manual trigger
 */
export async function GET() {
  try {
    logger.info('Starting manual metrics poller');
    
    // Validate environment variables
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables');
    }
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { result, duration } = await PerformanceMonitor.measureAsync(
      'manual-metrics-poller',
      async () => {
        // Get active submissions that need metrics refresh
        const submissions = await getSubmissionsToProcess(supabase);
        
        if (submissions.length === 0) {
          logger.info('No submissions need metrics refresh');
          return {
            success: true,
            message: 'No submissions need metrics refresh',
            processed: 0,
          };
        }

        logger.info(`Processing ${submissions.length} submissions manually`);

        // Process submissions with rate limiting
        const results = await processSubmissions(submissions);

        // Update submission metadata
        await updateSubmissionMetadata(results, supabase);

        // Store metrics in metrics_daily table
        await storeMetrics(results, supabase);

        const successCount = results.filter(r => r.success).length;
        const failureCount = results.length - successCount;

        logger.info(`Manual metrics poller completed`, {
          total: results.length,
          success: successCount,
          failures: failureCount,
          duration,
        });

        return {
          success: true,
          message: `Processed ${results.length} submissions`,
          processed: results.length,
          success_count: successCount,
          failure_count: failureCount,
          results: results.map(r => ({
            submission_id: r.submission_id,
            success: r.success,
            platform: r.platform,
            error: r.error,
          })),
        };
      }
    );

    return NextResponse.json(result);

  } catch (error) {
    logger.error('Metrics poller error:', error as Error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

/**
 * POST handler - Trigger with specific submissions
 */
export async function POST(req: NextRequest) {
  try {
    const { submission_ids } = await req.json();
    
    // Validate environment variables
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables');
    }
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    let submissions;
    if (submission_ids && submission_ids.length > 0) {
      // Process specific submissions
      const { data, error } = await supabase
        .from('submissions')
        .select(`
          id,
          platform_video_id,
          network,
          creator_id,
          last_metrics_fetch,
          meta
        `)
        .in('id', submission_ids)
        .eq('status', 'approved')
        .not('platform_video_id', 'is', null);

      if (error) throw error;
      submissions = data || [];
    } else {
      // Process all submissions that need refresh
      submissions = await getSubmissionsToProcess(supabase);
    }

    if (submissions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No submissions to process',
        processed: 0,
      });
    }

    // Process submissions
    const results = await processSubmissions(submissions);
    await updateSubmissionMetadata(results, supabase);
    await storeMetrics(results, supabase);

    return NextResponse.json({
      success: true,
      message: `Processed ${results.length} submissions`,
      processed: results.length,
      results,
    });

  } catch (error) {
    logger.error('Metrics poller error:', error as Error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

/**
 * Get submissions that need metrics refresh
 */
async function getSubmissionsToProcess(supabase: any): Promise<SubmissionToProcess[]> {
  const now = new Date();
  const refreshThreshold = new Date(now.getTime() - 5 * 60 * 1000); // 5 minutes ago

  const { data, error } = await supabase
    .from('submissions')
    .select(`
      id,
      platform_video_id,
      network,
      creator_id,
      last_metrics_fetch,
      meta
    `)
    .eq('status', 'approved')
    .not('platform_video_id', 'is', null)
    .or(`last_metrics_fetch.is.null,last_metrics_fetch.lt.${refreshThreshold.toISOString()}`);

  if (error) {
    throw new Error(`Failed to fetch submissions: ${error.message}`);
  }

  return data || [];
}

/**
 * Process submissions with rate limiting
 */
async function processSubmissions(
  submissions: SubmissionToProcess[]
): Promise<MetricsResult[]> {
  const results: MetricsResult[] = [];

  // Group submissions by platform
  const submissionsByPlatform = submissions.reduce((acc, submission) => {
    const platform = submission.network;
    if (!acc[platform]) acc[platform] = [];
    acc[platform].push(submission);
    return acc;
  }, {} as Record<string, SubmissionToProcess[]>);

  // Process each platform with its rate limit
  for (const [platform, platformSubmissions] of Object.entries(submissionsByPlatform)) {
        const limit = pLimit(METRICS_CONFIG.rateLimits[platform as keyof typeof METRICS_CONFIG.rateLimits] || 3);
    
    const platformResults = await Promise.allSettled(
      platformSubmissions.map(submission => 
        limit(() => processSubmission(submission))
      )
    );

    // Convert PromiseSettledResult to results
    platformResults.forEach((result, index) => {
      const submission = platformSubmissions[index];
      
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          submission_id: submission.id,
          success: false,
          error: result.reason?.message || 'Unknown error',
          platform: submission.network,
        });
      }
    });
  }

  return results;
}

/**
 * Process a single submission
 */
async function processSubmission(
  submission: SubmissionToProcess
): Promise<MetricsResult> {
  try {
    // Validate submission data
    if (!submission.platform_video_id) {
      throw new Error('Missing platform video ID');
    }

    let metrics;

    switch (submission.network) {
      case 'youtube':
        const youtubeConfig = await getYouTubeConfig(submission.creator_id);
        const youtubeMetrics = await fetchVideoMetrics(
          submission.platform_video_id,
          youtubeConfig
        );
        metrics = {
          views: youtubeMetrics.views,
          likes: youtubeMetrics.likes,
          comments: youtubeMetrics.comments,
          shares: 0,
          duration_seconds: youtubeMetrics.duration_seconds,
        };
        break;

      case 'tiktok':
        throw new Error('TikTok connector not implemented yet');

      case 'instagram':
        throw new Error('Instagram connector not implemented yet');

      default:
        throw new Error(`Unsupported platform: ${submission.network}`);
    }

    return {
      submission_id: submission.id,
      success: true,
      metrics,
      platform: submission.network,
    };

  } catch (error) {
    logger.error(`Error processing submission ${submission.id}:`, error as Error);
    return {
      submission_id: submission.id,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      platform: submission.network,
    };
  }
}

/**
 * Update submission metadata
 */
async function updateSubmissionMetadata(
  results: MetricsResult[],
  supabase: any
): Promise<void> {
  const updates = results
    .filter(r => r.success)
    .map(r => ({
      id: r.submission_id,
      last_metrics_fetch: new Date().toISOString(),
      meta: {
        last_fetch: new Date().toISOString(),
        last_views: r.metrics?.views || 0,
        platform: r.platform,
      },
    })) as any[];

  if (updates.length === 0) return;

  // Update each submission individually
  for (const update of updates) {
    try {
      const { error } = await supabase
        .from('submissions')
        .update({
          last_metrics_fetch: update.last_metrics_fetch,
          meta: update.meta
        })
        .eq('id', update.id);

      if (error) {
        logger.error('Failed to update submission metadata:', error as Error);
      }
    } catch (err) {
      logger.error('Error updating submission metadata:', err as Error);
    }
  }
}

/**
 * Store metrics in metrics_daily table
 */
async function storeMetrics(
  results: MetricsResult[],
  supabase: any
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const metricsToStore = results
    .filter(r => r.success && r.metrics)
    .map(r => ({
      submission_id: r.submission_id,
      date: today,
      views: r.metrics!.views,
      likes: r.metrics!.likes,
      comments: r.metrics!.comments,
      shares: r.metrics!.shares,
      engagement_rate: calculateEngagementRate(r.metrics!),
    }));

  if (metricsToStore.length === 0) return;

  const { error } = await supabase
    .from('metrics_daily')
    .upsert(metricsToStore, { 
      onConflict: 'submission_id,date'
    });

  if (error) {
    logger.error('Failed to store metrics:', error as Error);
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
  return Math.round((totalEngagement / metrics.views) * 100 * 100) / 100;
}
