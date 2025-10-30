/**
 * Metrics Poller Edge Function (Supabase/Deno)
 * 
 * Fetches metrics for active submissions from various platforms
 * Runs on a schedule (every 5 minutes) or can be triggered manually
 * 
 * Features:
 * - Rate limiting with concurrent request control
 * - Exponential backoff for failed requests
 * - Platform-specific refresh intervals
 * - Metrics storage in metrics_daily table
 * - Submission metadata updates
 * - Performance monitoring and error tracking
 * - Batch processing optimization
 */

// @ts-ignore: Deno imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore: ESM import for Deno
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Types
interface SubmissionToProcess {
  id: string;
  platform_video_id: string;
  network: 'youtube' | 'tiktok' | 'instagram';
  creator_id: string;
  last_metrics_fetch: string | null;
  meta: Record<string, any>;
}

interface MetricsResult {
  submission_id: string;
  success: boolean;
  metrics?: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    duration_seconds: number;
  };
  error?: string;
  platform: string;
}

interface MetricsConfig {
  rateLimits: {
    youtube: number;
    tiktok: number;
    instagram: number;
  };
  refreshIntervals: {
    youtube: number;
    tiktok: number;
    instagram: number;
  };
  batchSize: number;
  maxRetries: number;
  retryDelay: number;
}

// Configuration
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
 * Simple rate limiter for concurrent requests
 */
class RateLimiter {
  private queue: Array<() => Promise<any>> = [];
  private running = 0;

  constructor(private limit: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    while (this.running >= this.limit) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.running++;
    try {
      return await fn();
    } finally {
      this.running--;
    }
  }
}

/**
 * Performance logger
 */
function logPerformance(operation: string, duration: number, metadata?: any) {
  console.log(JSON.stringify({
    level: 'info',
    operation,
    duration_ms: duration,
    ...metadata,
    timestamp: new Date().toISOString(),
  }));
}

/**
 * Error logger
 */
function logError(operation: string, error: Error, metadata?: any) {
  console.error(JSON.stringify({
    level: 'error',
    operation,
    error: error.message,
    stack: error.stack,
    ...metadata,
    timestamp: new Date().toISOString(),
  }));
}

/**
 * Main handler
 */
serve(async (req: Request) => {
  const startTime = Date.now();

  try {
    // @ts-ignore: Deno global
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    // @ts-ignore: Deno global
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting metrics poller execution');

    // Get submissions to process
    const submissions = await getSubmissionsToProcess(supabase);
    
    if (submissions.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No submissions need metrics refresh',
          processed: 0,
        }),
        { 
          status: 200,
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Processing ${submissions.length} submissions`);

    // Process submissions with rate limiting
    const results = await processSubmissions(submissions, supabase);

    // Update submission metadata
    await updateSubmissionMetadata(results, supabase);

    // Store metrics
    await storeMetrics(results, supabase);

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;
    const duration = Date.now() - startTime;

    logPerformance('metrics-poller-execution', duration, {
      total: results.length,
      success: successCount,
      failures: failureCount,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${results.length} submissions`,
        processed: results.length,
        success_count: successCount,
        failure_count: failureCount,
        duration_ms: duration,
        results: results.map(r => ({
          submission_id: r.submission_id,
          success: r.success,
          platform: r.platform,
          error: r.error,
        })),
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    const duration = Date.now() - startTime;
    logError('metrics-poller-execution', error as Error, { duration });

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
});

/**
 * Get submissions that need metrics refresh
 */
async function getSubmissionsToProcess(supabase: SupabaseClient): Promise<SubmissionToProcess[]> {
  const startTime = Date.now();
  
  try {
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
      .or(`last_metrics_fetch.is.null,last_metrics_fetch.lt.${refreshThreshold.toISOString()}`)
      .limit(METRICS_CONFIG.batchSize);

    if (error) {
      throw new Error(`Failed to fetch submissions: ${error.message}`);
    }

    const duration = Date.now() - startTime;
    logPerformance('get-submissions-to-process', duration, { count: data?.length || 0 });

    return data || [];
  } catch (error) {
    logError('get-submissions-to-process', error as Error);
    throw error;
  }
}

/**
 * Process submissions with rate limiting
 */
async function processSubmissions(
  submissions: SubmissionToProcess[],
  supabase: SupabaseClient
): Promise<MetricsResult[]> {
  const startTime = Date.now();
  const results: MetricsResult[] = [];

  // Group by platform
  const submissionsByPlatform = submissions.reduce((acc, submission) => {
    const platform = submission.network;
    if (!acc[platform]) acc[platform] = [];
    acc[platform].push(submission);
    return acc;
  }, {} as Record<string, SubmissionToProcess[]>);

  console.log(`Processing by platform: ${Object.keys(submissionsByPlatform).join(', ')}`);

  // Process each platform with rate limiting
  for (const [platform, platformSubmissions] of Object.entries(submissionsByPlatform)) {
    const limiter = new RateLimiter(
      METRICS_CONFIG.rateLimits[platform as keyof typeof METRICS_CONFIG.rateLimits] || 3
    );
    
    console.log(`Processing ${platformSubmissions.length} ${platform} submissions`);

    const platformResults = await Promise.allSettled(
      platformSubmissions.map(submission => 
        limiter.run(() => processSubmission(submission, supabase))
      )
    );

    platformResults.forEach((result, index) => {
      const submission = platformSubmissions[index];
      
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        const error = result.reason as Error;
        logError('process-submission', error, {
          submission_id: submission.id,
          platform: submission.network,
        });
        
        results.push({
          submission_id: submission.id,
          success: false,
          error: error?.message || 'Unknown error',
          platform: submission.network,
        });
      }
    });

    const platformSuccess = platformResults.filter(r => r.status === 'fulfilled').length;
    console.log(`${platform}: ${platformSuccess}/${platformSubmissions.length} successful`);
  }

  const duration = Date.now() - startTime;
  logPerformance('process-submissions', duration, { total: submissions.length });

  return results;
}

/**
 * Process single submission
 * 
 * NOTE: This function requires platform-specific API credentials and logic.
 * In a real implementation, you would:
 * 1. Fetch creator's platform credentials from database
 * 2. Call platform-specific APIs (YouTube, TikTok, Instagram)
 * 3. Parse and return metrics
 * 
 * For now, this returns mock data or errors.
 */
async function processSubmission(
  submission: SubmissionToProcess,
  _supabase: SupabaseClient
): Promise<MetricsResult> {
  const startTime = Date.now();

  try {
    // TODO: Implement actual platform API calls
    // This would require fetching credentials and calling:
    // - YouTube Data API
    // - TikTok API
    // - Instagram Graph API

    // For now, return an error indicating this needs implementation
    throw new Error(
      `Platform metrics fetching not implemented yet for ${submission.network}. ` +
      `Please implement API integration in production.`
    );

    // Example structure when implemented:
    /*
    let metrics;
    
    switch (submission.network) {
      case 'youtube':
        metrics = await fetchYouTubeMetrics(submission);
        break;
      case 'tiktok':
        metrics = await fetchTikTokMetrics(submission);
        break;
      case 'instagram':
        metrics = await fetchInstagramMetrics(submission);
        break;
      default:
        throw new Error(`Unsupported platform: ${submission.network}`);
    }

    const duration = Date.now() - startTime;
    logPerformance('process-submission', duration, {
      submission_id: submission.id,
      platform: submission.network,
    });

    return {
      submission_id: submission.id,
      success: true,
      metrics,
      platform: submission.network,
    };
    */

  } catch (error) {
    const duration = Date.now() - startTime;
    logError('process-submission', error as Error, {
      submission_id: submission.id,
      platform: submission.network,
      duration,
    });

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
  supabase: SupabaseClient
): Promise<void> {
  const startTime = Date.now();

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
    }));

  if (updates.length === 0) {
    console.log('No submission metadata to update');
    return;
  }

  try {
    const { error } = await supabase
      .from('submissions')
      .upsert(updates, { onConflict: 'id' });

    if (error) {
      throw new Error(`Failed to update submission metadata: ${error.message}`);
    }

    const duration = Date.now() - startTime;
    logPerformance('update-submission-metadata', duration, { count: updates.length });
  } catch (error) {
    logError('update-submission-metadata', error as Error);
    throw error;
  }
}

/**
 * Store metrics in metrics_daily table
 */
async function storeMetrics(
  results: MetricsResult[],
  supabase: SupabaseClient
): Promise<void> {
  const startTime = Date.now();

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

  if (metricsToStore.length === 0) {
    console.log('No metrics to store');
    return;
  }

  try {
    const { error } = await supabase
      .from('metrics_daily')
      .upsert(metricsToStore, { 
        onConflict: 'submission_id,date',
        ignoreDuplicates: false 
      });

    if (error) {
      throw new Error(`Failed to store metrics: ${error.message}`);
    }

    const duration = Date.now() - startTime;
    logPerformance('store-metrics', duration, { count: metricsToStore.length });
  } catch (error) {
    logError('store-metrics', error as Error);
    throw error;
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

/**
 * Exponential backoff utility
 */
export async function withBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error('Max retries exceeded');
}
