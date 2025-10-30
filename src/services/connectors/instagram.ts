/**
 * Instagram Graph API Connector
 * 
 * Complete implementation for Instagram Graph API
 * 
 * Required OAuth Scopes:
 * - instagram_basic (read basic profile)
 * - instagram_content_publish (publish content - if needed)
 * - pages_read_engagement (read page insights)
 * 
 * API Endpoints:
 * - GET /{ig-user-id}/media - Get user's media
 * - GET /{media-id} - Get specific media details
 * - GET /{media-id}/insights - Get media insights/metrics
 */

import { createClient } from '@supabase/supabase-js';
import { logger, PerformanceMonitor, ErrorTracker } from '@/lib/logger';
import { SupabaseClientType } from '@/lib/supabase/types';

export interface InstagramMetrics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  duration_seconds: number;
  raw: {
    media_info: Record<string, unknown>;
    insights: Record<string, unknown>;
  };
}

export interface InstagramConfig {
  accessToken: string;
  refreshToken?: string;
  appId: string;
  appSecret: string;
  igUserId: string; // Instagram Business account ID
}

export interface InstagramMediaData {
  id: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  media_url: string;
  permalink: string;
  timestamp: string;
  caption?: string;
  like_count?: number;
  comments_count?: number;
  video_title?: string;
}

export interface InstagramInsightsData {
  impressions?: number;
  reach?: number;
  video_views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  engagement?: number;
}

/**
 * Fetches video metrics from Instagram Graph API
 * 
 * Instagram Graph API requires:
 * 1. Facebook Business account
 * 2. Instagram Business account connected to Facebook Page
 * 3. App review for production access
 * 4. Proper OAuth scopes
 * 
 * Implementation steps:
 * 1. Set up Facebook App with Instagram Basic Display
 * 2. Implement OAuth flow with required scopes
 * 3. Store encrypted tokens in database
 * 4. Handle token refresh (Instagram tokens don't expire)
 * 5. Parse Instagram-specific metrics format
 */
export async function fetchVideoMetrics(
  platformVideoId: string,
  config: InstagramConfig
): Promise<InstagramMetrics> {
  const { result, duration } = await PerformanceMonitor.measureAsync(
    'fetch-instagram-metrics',
    async () => {
      try {
        // First, get media details
        const mediaData = await getInstagramMediaDetails(platformVideoId, config);
        
        // Then, get insights if available
        const insightsData = await getInstagramMediaInsights(platformVideoId, config);
        
        // Parse duration from media data
        const duration_seconds = parseInstagramDuration(mediaData);
        
        const metrics: InstagramMetrics = {
          views: insightsData.video_views || insightsData.impressions || 0,
          likes: insightsData.likes || mediaData.like_count || 0,
          comments: insightsData.comments || mediaData.comments_count || 0,
          shares: insightsData.shares || 0,
          duration_seconds,
          raw: {
            media_info: mediaData as unknown as Record<string, unknown>,
            insights: insightsData as unknown as Record<string, unknown>,
          },
        };

        logger.logMetricsOperation('fetch', 'instagram', platformVideoId, true, duration);
        return metrics;
      } catch (error) {
        ErrorTracker.trackApiError('instagram', 'media', 0, error as Error);
        logger.logMetricsOperation('fetch', 'instagram', platformVideoId, false, duration, error as Error);
        throw error;
      }
    }
  );

  return result;
}

/**
 * Instagram token refresh
 * Note: Instagram access tokens don't expire, but may need refresh for security
 */
export async function refreshInstagramToken(_refreshToken: string): Promise<string> {
  const { result, duration } = await PerformanceMonitor.measureAsync(
    'refresh-instagram-token',
    async () => {
      try {
        const response = await fetch('https://graph.instagram.com/refresh_access_token', {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`Instagram token refresh failed: ${response.status} - ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        
        if (!data.access_token) {
          throw new Error('No access token in refresh response');
        }

        logger.info('Instagram token refreshed successfully', { duration });
        return data.access_token;
      } catch (error) {
        ErrorTracker.trackError(error as Error, {
          operation: 'refresh-instagram-token',
          platform: 'instagram',
        });
        throw error;
      }
    }
  );

  return result;
}

/**
 * Get Instagram configuration from database
 */
export async function getInstagramConfig(creatorId: string): Promise<InstagramConfig> {
  const { result, duration } = await PerformanceMonitor.measureAsync(
    'get-instagram-config',
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
        const instagramTokens = socialMedia?.instagram as Record<string, unknown>;

        if (!instagramTokens?.access_token) {
          throw new Error('Instagram access token not found for creator');
        }

        return {
          accessToken: instagramTokens.access_token as string,
          refreshToken: instagramTokens.refresh_token as string,
          appId: process.env.INSTAGRAM_APP_ID!,
          appSecret: process.env.INSTAGRAM_APP_SECRET!,
          igUserId: instagramTokens.ig_user_id as string,
        };
      } catch (error) {
        ErrorTracker.trackDatabaseError('get-instagram-config', 'profiles', error as Error);
        throw error;
      }
    }
  );

  logger.logMetricsOperation('config-fetch', 'instagram', creatorId, true, duration);
  return result;
}

/**
 * Validate Instagram media ID format
 */
export function isValidInstagramMediaId(mediaId: string): boolean {
  // Instagram media IDs are typically numeric strings
  // They can be 15-19 digits long
  return /^\d{15,19}$/.test(mediaId);
}

/**
 * Extract Instagram media ID from URL
 */
export function extractInstagramMediaId(url: string): string | null {
  const patterns = [
    // Instagram post URLs
    /instagram\.com\/p\/([a-zA-Z0-9_-]+)/,
    // Instagram reel URLs
    /instagram\.com\/reel\/([a-zA-Z0-9_-]+)/,
    // Instagram TV URLs
    /instagram\.com\/tv\/([a-zA-Z0-9_-]+)/,
    // Instagram story URLs (if accessible)
    /instagram\.com\/stories\/[^\/]+\/(\d+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      // Convert shortcode to media ID if needed
      return match[1];
    }
  }

  return null;
}

/**
 * Get Instagram media details from Graph API
 */
async function getInstagramMediaDetails(
  mediaId: string,
  config: InstagramConfig
): Promise<InstagramMediaData> {
  const { result, duration } = await PerformanceMonitor.measureAsync(
    'get-instagram-media-details',
    async () => {
      try {
        const response = await fetch(
          `https://graph.instagram.com/${mediaId}?fields=id,media_type,media_url,permalink,timestamp,caption,like_count,comments_count,video_title&access_token=${config.accessToken}`,
          {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'ClipRace/1.0',
            },
          }
        );

        logger.logApiCall('instagram', 'media', response.status, duration);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`Instagram API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        return data as InstagramMediaData;
      } catch (error) {
        ErrorTracker.trackApiError('instagram', 'media', 0, error as Error);
        throw error;
      }
    }
  );

  return result;
}

/**
 * Get Instagram media insights from Graph API
 */
async function getInstagramMediaInsights(
  mediaId: string,
  config: InstagramConfig
): Promise<InstagramInsightsData> {
  const { result, duration } = await PerformanceMonitor.measureAsync(
    'get-instagram-media-insights',
    async () => {
      try {
        const response = await fetch(
          `https://graph.instagram.com/${mediaId}/insights?metric=impressions,reach,video_views,likes,comments,shares,saves,engagement&access_token=${config.accessToken}`,
          {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'ClipRace/1.0',
            },
          }
        );

        logger.logApiCall('instagram', 'insights', response.status, duration);

        if (!response.ok) {
          // Insights might not be available for all media types
          if (response.status === 400) {
            logger.warn('Instagram insights not available for this media type', { mediaId });
            return {};
          }
          
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`Instagram insights API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        
        // Parse insights data
        const insights: InstagramInsightsData = {};
        if (data.data) {
          for (const metric of data.data) {
            switch (metric.name) {
              case 'impressions':
                insights.impressions = metric.values[0]?.value || 0;
                break;
              case 'reach':
                insights.reach = metric.values[0]?.value || 0;
                break;
              case 'video_views':
                insights.video_views = metric.values[0]?.value || 0;
                break;
              case 'likes':
                insights.likes = metric.values[0]?.value || 0;
                break;
              case 'comments':
                insights.comments = metric.values[0]?.value || 0;
                break;
              case 'shares':
                insights.shares = metric.values[0]?.value || 0;
                break;
              case 'saves':
                insights.saves = metric.values[0]?.value || 0;
                break;
              case 'engagement':
                insights.engagement = metric.values[0]?.value || 0;
                break;
            }
          }
        }

        return insights;
      } catch (error) {
        ErrorTracker.trackApiError('instagram', 'insights', 0, error as Error);
        throw error;
      }
    }
  );

  return result;
}

/**
 * Parse Instagram video duration from media data
 */
function parseInstagramDuration(_mediaData: InstagramMediaData): number {
  // Instagram doesn't provide duration in basic API
  // This would need to be extracted from video metadata or additional API calls
  // For now, return 0 as placeholder
  return 0;
}

/**
 * Test function for Instagram connector
 */
export async function testInstagramConnector(mediaId: string): Promise<{
  success: boolean;
  metrics?: InstagramMetrics;
  error?: string;
}> {
  try {
    const config = {
      accessToken: process.env.INSTAGRAM_ACCESS_TOKEN!,
      appId: process.env.INSTAGRAM_APP_ID!,
      appSecret: process.env.INSTAGRAM_APP_SECRET!,
      igUserId: process.env.INSTAGRAM_USER_ID!,
    };

    const metrics = await fetchVideoMetrics(mediaId, config);
    
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
 * Instagram Graph API Setup Guide:
 * 
 * 1. Create Facebook App at https://developers.facebook.com/
 * 2. Add Instagram Basic Display product
 * 3. Configure OAuth redirect URIs
 * 4. Request required permissions:
 *    - instagram_basic
 *    - instagram_content_publish (if needed)
 *    - pages_read_engagement
 * 5. Submit app for review (required for production)
 * 
 * Rate Limits:
 * - 200 requests/hour per user
 * - 4800 requests/hour per app
 * 
 * Webhook Support:
 * - Instagram supports webhooks via Facebook Graph API
 * - Configure webhook subscriptions in Facebook App
 * - Verify webhook signatures for security
 * 
 * Important Notes:
 * - Only works with Instagram Business accounts
 * - Requires Facebook Page connection
 * - Some metrics require app review
 * - Video metrics may have delays (up to 24h)
 * 
 * Environment Variables Required:
 * - INSTAGRAM_APP_ID: Facebook App ID
 * - INSTAGRAM_APP_SECRET: Facebook App Secret
 * - INSTAGRAM_ACCESS_TOKEN: User access token (stored in database)
 * - INSTAGRAM_USER_ID: Instagram Business account ID
 * 
 * Database Schema:
 * - profiles.social_media.instagram.access_token
 * - profiles.social_media.instagram.refresh_token
 * - profiles.social_media.instagram.ig_user_id
 * 
 * Usage Example:
 * ```typescript
 * const config = await getInstagramConfig(creatorId);
 * const metrics = await fetchVideoMetrics(mediaId, config);
 * console.log(metrics.views, metrics.likes, metrics.comments);
 * ```
 */
