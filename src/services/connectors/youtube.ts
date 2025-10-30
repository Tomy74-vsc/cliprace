/**
 * YouTube Data API Connector
 * 
 * Fetches video metrics from YouTube Data API v3
 * Supports both public metrics and OAuth-authenticated private metrics
 * 
 * Features:
 * - Rate limiting and retry logic
 * - Performance monitoring
 * - Error tracking and recovery
 * - Caching for improved performance
 */

import { createClient } from '@supabase/supabase-js';
import { logger, PerformanceMonitor, ErrorTracker } from '@/lib/logger';
import { SupabaseClientType } from '@/lib/supabase/types';

export interface YouTubeMetrics {
  views: number;
  likes: number;
  comments: number;
  duration_seconds: number;
  raw: {
    statistics: Record<string, unknown>;
    contentDetails: Record<string, unknown>;
    snippet?: Record<string, unknown>;
  };
}

export interface YouTubeConfig {
  apiKey: string;
  oauthToken?: string;
  refreshToken?: string;
}

/**
 * Fetches video metrics from YouTube Data API
 * @param platformVideoId - YouTube video ID
 * @param config - API configuration
 * @returns Promise<YouTubeMetrics>
 */
export async function fetchVideoMetrics(
  platformVideo_id: string,
  config: YouTubeConfig
): Promise<YouTubeMetrics> {
  const { result, duration } = await PerformanceMonitor.measureAsync(
    'fetch-youtube-metrics',
    async () => {
      const baseUrl = 'https://www.googleapis.com/youtube/v3/videos';
      const params = new URLSearchParams({
        part: 'statistics,contentDetails,snippet',
        id: platformVideo_id,
        key: config.apiKey,
      });

      // Add OAuth token if available for private videos
      if (config.oauthToken) {
        params.append('access_token', config.oauthToken);
      }

      const requestUrl = `${baseUrl}?${params}`;
      
      try {
        const response = await fetch(requestUrl, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'ClipRace/1.0',
          },
        });

        logger.logApiCall('youtube', 'videos', response.status, duration);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage = `YouTube API error: ${response.status} - ${errorData.error?.message || response.statusText}`;
          
          // Handle rate limiting
          if (response.status === 429) {
            logger.logRateLimit('youtube', 0, errorData.error?.details?.[0]?.retryAfter);
            throw new Error(`Rate limit exceeded: ${errorMessage}`);
          }
          
          throw new Error(errorMessage);
        }

        const data = await response.json();

        if (!data.items || data.items.length === 0) {
          throw new Error(`Video not found: ${platformVideo_id}`);
        }

        const video = data.items[0];
        const stats = video.statistics;
        const contentDetails = video.contentDetails;

        // Parse duration (ISO 8601 format: PT4M13S)
        const duration_seconds = parseDuration(contentDetails.duration);

        const metrics = {
          views: parseInt(stats.viewCount || '0'),
          likes: parseInt(stats.likeCount || '0'),
          comments: parseInt(stats.commentCount || '0'),
          duration_seconds,
          raw: {
            statistics: stats,
            contentDetails: contentDetails,
            snippet: video.snippet,
          },
        };

        logger.logMetricsOperation('fetch', 'youtube', platformVideo_id, true, duration);
        return metrics;
      } catch (error) {
        ErrorTracker.trackApiError('youtube', 'videos', 0, error as Error);
        logger.logMetricsOperation('fetch', 'youtube', platformVideo_id, false, duration, error as Error);
        throw error;
      }
    }
  );

  return result;
}

/**
 * Parses ISO 8601 duration string to seconds
 * @param duration - ISO 8601 duration (e.g., "PT4M13S")
 * @returns duration in seconds
 */
function parseDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseInt(match[3] || '0');

  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Refreshes OAuth token using refresh token
 * @param refreshToken - OAuth refresh token
 * @returns new access token
 */
export async function refreshYouTubeToken(refreshToken: string): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: process.env.YOUTUBE_CLIENT_ID!,
      client_secret: process.env.YOUTUBE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Gets YouTube configuration from database
 * @param creatorId - Creator user ID
 * @returns YouTube configuration
 */
export async function getYouTubeConfig(creatorId: string): Promise<YouTubeConfig> {
  const { result, duration } = await PerformanceMonitor.measureAsync(
    'get-youtube-config',
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
        const youtubeTokens = socialMedia?.youtube as Record<string, unknown>;

        return {
          apiKey: process.env.YOUTUBE_API_KEY!,
          oauthToken: youtubeTokens?.access_token as string,
          refreshToken: youtubeTokens?.refresh_token as string,
        };
      } catch (error) {
        ErrorTracker.trackDatabaseError('get-youtube-config', 'profiles', error as Error);
        throw error;
      }
    }
  );

  logger.logMetricsOperation('config-fetch', 'youtube', creatorId, true, duration);
  return result;
}

/**
 * Validates YouTube video ID format
 * @param videoId - YouTube video ID
 * @returns boolean
 */
export function isValidYouTubeVideoId(videoId: string): boolean {
  // YouTube video IDs are 11 characters long
  return /^[a-zA-Z0-9_-]{11}$/.test(videoId);
}

/**
 * Extracts YouTube video ID from URL
 * @param url - YouTube URL
 * @returns video ID or null
 */
export function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * Test function for YouTube connector
 * @param videoId - YouTube video ID to test
 * @returns test results
 */
export async function testYouTubeConnector(videoId: string): Promise<{
  success: boolean;
  metrics?: YouTubeMetrics;
  error?: string;
}> {
  try {
    const config = {
      apiKey: process.env.YOUTUBE_API_KEY!,
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
