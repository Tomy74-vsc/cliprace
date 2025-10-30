/**
 * TikTok Business API Connector
 * 
 * Complete implementation for TikTok Business API
 * 
 * Required OAuth Scopes:
 * - user.info.basic (read user profile)
 * - video.list (read user's videos)
 * - video.publish (publish videos - if needed)
 * 
 * API Endpoints:
 * - GET /user/info/ - Get user profile
 * - GET /video/list/ - Get user's videos with metrics
 * - GET /video/query/ - Get specific video details
 */

import { createClient } from '@supabase/supabase-js';
import { logger, PerformanceMonitor, ErrorTracker } from '@/lib/logger';
import { SupabaseClientType } from '@/lib/supabase/types';

export interface TikTokMetrics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  duration_seconds: number;
  raw: {
    video_info: Record<string, unknown>;
    statistics: Record<string, unknown>;
  };
}

export interface TikTokConfig {
  accessToken: string;
  refreshToken?: string;
  clientId: string;
  clientSecret: string;
}

export interface TikTokVideoData {
  id: string;
  title: string;
  description: string;
  duration: number;
  cover_image_url: string;
  video_url: string;
  create_time: number;
  share_url: string;
  embed_url: string;
}

export interface TikTokVideoStats {
  view_count: number;
  like_count: number;
  comment_count: number;
  share_count: number;
  play_count: number;
  download_count: number;
}

/**
 * Fetches video metrics from TikTok Business API
 * 
 * TikTok Business API requires:
 * 1. OAuth 2.0 authentication with proper scopes
 * 2. Business account verification
 * 3. API key approval from TikTok
 * 
 * Implementation steps:
 * 1. Set up OAuth flow with TikTok Business
 * 2. Store encrypted tokens in database
 * 3. Implement token refresh mechanism
 * 4. Handle rate limiting (100 requests/hour for basic tier)
 * 5. Parse TikTok-specific metrics format
 */
export async function fetchVideoMetrics(
  platformVideoId: string,
  config: TikTokConfig
): Promise<TikTokMetrics> {
  const { result, duration } = await PerformanceMonitor.measureAsync(
    'fetch-tiktok-metrics',
    async () => {
      try {
        // First, get video details
        const videoData = await getTikTokVideoDetails(platformVideoId, config);
        
        // Then, get video statistics
        const videoStats = await getTikTokVideoStats(platformVideoId, config);
        
        const metrics: TikTokMetrics = {
          views: videoStats.view_count || videoStats.play_count || 0,
          likes: videoStats.like_count || 0,
          comments: videoStats.comment_count || 0,
          shares: videoStats.share_count || 0,
          duration_seconds: videoData.duration || 0,
          raw: {
            video_info: videoData as unknown as Record<string, unknown>,
            statistics: videoStats as unknown as Record<string, unknown>,
          },
        };

        logger.logMetricsOperation('fetch', 'tiktok', platformVideoId, true, duration);
        return metrics;
      } catch (error) {
        ErrorTracker.trackApiError('tiktok', 'video', 0, error as Error);
        logger.logMetricsOperation('fetch', 'tiktok', platformVideoId, false, duration, error as Error);
        throw error;
      }
    }
  );

  return result;
}

/**
 * TikTok OAuth token refresh
 */
export async function refreshTikTokToken(refreshToken: string): Promise<string> {
  const { result, duration } = await PerformanceMonitor.measureAsync(
    'refresh-tiktok-token',
    async () => {
      try {
        const response = await fetch('https://open-api.tiktok.com/oauth/refresh_token/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`TikTok token refresh failed: ${response.status} - ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        
        if (!data.access_token) {
          throw new Error('No access token in refresh response');
        }

        logger.info('TikTok token refreshed successfully', { duration });
        return data.access_token;
      } catch (error) {
        ErrorTracker.trackError(error as Error, {
          operation: 'refresh-tiktok-token',
          platform: 'tiktok',
        });
        throw error;
      }
    }
  );

  return result;
}

/**
 * Get TikTok configuration from database
 */
export async function getTikTokConfig(creatorId: string): Promise<TikTokConfig> {
  const { result, duration } = await PerformanceMonitor.measureAsync(
    'get-tiktok-config',
    async () => {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      ) as SupabaseClientType;
      
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('social_media')
          .eq('id', creatorId)
          .single();

        if (error) {
          throw new Error(`Failed to fetch profile: ${error.message}`);
        }

        const socialMedia = (profile as any)?.social_media as Record<string, unknown>;
        const tiktokTokens = socialMedia?.tiktok as Record<string, unknown>;

        if (!tiktokTokens?.access_token) {
          throw new Error('TikTok access token not found for creator');
        }

        return {
          accessToken: tiktokTokens.access_token as string,
          refreshToken: tiktokTokens.refresh_token as string,
          clientId: process.env.TIKTOK_CLIENT_ID!,
          clientSecret: process.env.TIKTOK_CLIENT_SECRET!,
        };
      } catch (error) {
        ErrorTracker.trackDatabaseError('get-tiktok-config', 'profiles', error as Error);
        throw error;
      }
    }
  );

  logger.logMetricsOperation('config-fetch', 'tiktok', creatorId, true, duration);
  return result;
}

/**
 * Validate TikTok video ID format
 */
export function isValidTikTokVideoId(videoId: string): boolean {
  // TikTok video IDs are typically numeric strings
  // They can be 15-19 digits long
  return /^\d{15,19}$/.test(videoId);
}

/**
 * Extract TikTok video ID from URL
 */
export function extractTikTokVideoId(url: string): string | null {
  const patterns = [
    // TikTok video URLs
    /tiktok\.com\/@[^\/]+\/video\/(\d+)/,
    /tiktok\.com\/v\/(\d+)/,
    // TikTok mobile URLs
    /vm\.tiktok\.com\/[a-zA-Z0-9]+\/.*?(\d+)/,
    // TikTok short URLs
    /tiktok\.com\/t\/([a-zA-Z0-9]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * Get TikTok video details from Business API
 */
async function getTikTokVideoDetails(
  videoId: string,
  config: TikTokConfig
): Promise<TikTokVideoData> {
  const { result, duration } = await PerformanceMonitor.measureAsync(
    'get-tiktok-video-details',
    async () => {
      try {
        const response = await fetch(
          `https://open-api.tiktok.com/video/query/?video_id=${videoId}`,
          {
            headers: {
              'Authorization': `Bearer ${config.accessToken}`,
              'Accept': 'application/json',
              'User-Agent': 'ClipRace/1.0',
            },
          }
        );

        logger.logApiCall('tiktok', 'video/query', response.status, duration);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`TikTok API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        
        if (!data.data || !data.data.video_list || data.data.video_list.length === 0) {
          throw new Error(`Video not found: ${videoId}`);
        }

        const video = data.data.video_list[0];
        return {
          id: video.id,
          title: video.title || '',
          description: video.desc || '',
          duration: video.duration || 0,
          cover_image_url: video.cover_image_url || '',
          video_url: video.video_url || '',
          create_time: video.create_time || 0,
          share_url: video.share_url || '',
          embed_url: video.embed_url || '',
        };
      } catch (error) {
        ErrorTracker.trackApiError('tiktok', 'video/query', 0, error as Error);
        throw error;
      }
    }
  );

  return result;
}

/**
 * Get TikTok video statistics from Business API
 */
async function getTikTokVideoStats(
  videoId: string,
  config: TikTokConfig
): Promise<TikTokVideoStats> {
  const { result, duration } = await PerformanceMonitor.measureAsync(
    'get-tiktok-video-stats',
    async () => {
      try {
        const response = await fetch(
          `https://open-api.tiktok.com/video/query/?video_id=${videoId}&fields=id,title,create_time,duration,cover_image_url,video_url,share_url,embed_url,statistics`,
          {
            headers: {
              'Authorization': `Bearer ${config.accessToken}`,
              'Accept': 'application/json',
              'User-Agent': 'ClipRace/1.0',
            },
          }
        );

        logger.logApiCall('tiktok', 'video/stats', response.status, duration);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`TikTok stats API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        
        if (!data.data || !data.data.video_list || data.data.video_list.length === 0) {
          throw new Error(`Video stats not found: ${videoId}`);
        }

        const video = data.data.video_list[0];
        const stats = video.statistics || {};
        
        return {
          view_count: stats.view_count || 0,
          like_count: stats.like_count || 0,
          comment_count: stats.comment_count || 0,
          share_count: stats.share_count || 0,
          play_count: stats.play_count || 0,
          download_count: stats.download_count || 0,
        };
      } catch (error) {
        ErrorTracker.trackApiError('tiktok', 'video/stats', 0, error as Error);
        throw error;
      }
    }
  );

  return result;
}

/**
 * Test function for TikTok connector
 */
export async function testTikTokConnector(videoId: string): Promise<{
  success: boolean;
  metrics?: TikTokMetrics;
  error?: string;
}> {
  try {
    const config = {
      accessToken: process.env.TIKTOK_ACCESS_TOKEN!,
      clientId: process.env.TIKTOK_CLIENT_ID!,
      clientSecret: process.env.TIKTOK_CLIENT_SECRET!,
    };

    const metrics = await fetchVideoMetrics(videoId, config);
    
    return {
      success: true,
      metrics,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * TikTok Business API Setup Guide:
 * 
 * 1. Register at https://developers.tiktok.com/
 * 2. Create a Business account
 * 3. Apply for API access (requires business verification)
 * 4. Configure OAuth redirect URIs
 * 5. Request required scopes:
 *    - user.info.basic
 *    - video.list
 *    - video.publish (if needed)
 * 
 * Rate Limits:
 * - Basic: 100 requests/hour
 * - Pro: 1000 requests/hour
 * - Enterprise: Custom limits
 * 
 * Webhook Support:
 * - TikTok supports webhooks for real-time notifications
 * - Configure webhook URL in TikTok Developer Portal
 * - Verify webhook signatures for security
 * 
 * Environment Variables Required:
 * - TIKTOK_CLIENT_ID: TikTok App Client ID
 * - TIKTOK_CLIENT_SECRET: TikTok App Client Secret
 * - TIKTOK_ACCESS_TOKEN: User access token (stored in database)
 * 
 * Database Schema:
 * - profiles.social_media.tiktok.access_token
 * - profiles.social_media.tiktok.refresh_token
 * 
 * Usage Example:
 * ```typescript
 * const config = await getTikTokConfig(creatorId);
 * const metrics = await fetchVideoMetrics(videoId, config);
 * console.log(metrics.views, metrics.likes, metrics.comments);
 * ```
 */
