/**
 * Configuration example for Metrics Poller Edge Function
 * 
 * Copy this to Supabase Dashboard:
 * Settings > Edge Functions > Secrets
 */

export const CONFIG_EXAMPLE = {
  // Automatically provided by Supabase
  SUPABASE_URL: 'https://your-project-ref.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'your-service-role-key',

  // YouTube Data API v3
  // Get from: https://console.cloud.google.com/apis/credentials
  YOUTUBE_API_KEY: 'your-youtube-api-key',

  // TikTok for Developers
  // Get from: https://developers.tiktok.com/
  TIKTOK_CLIENT_KEY: 'your-tiktok-client-key',
  TIKTOK_CLIENT_SECRET: 'your-tiktok-client-secret',

  // Instagram/Facebook Graph API
  // Get from: https://developers.facebook.com/apps/
  INSTAGRAM_CLIENT_ID: 'your-instagram-client-id',
  INSTAGRAM_CLIENT_SECRET: 'your-instagram-client-secret',
  INSTAGRAM_API_VERSION: 'v18.0',

  // Optional configuration
  METRICS_BATCH_SIZE: '50',
  METRICS_RETRY_ATTEMPTS: '3',
  METRICS_RETRY_DELAY: '1000',

  // Rate Limits (concurrent requests)
  YOUTUBE_RATE_LIMIT: '5',
  TIKTOK_RATE_LIMIT: '3',
  INSTAGRAM_RATE_LIMIT: '3',
};

/**
 * How to set these in Supabase:
 * 
 * 1. Via Supabase CLI:
 *    supabase secrets set YOUTUBE_API_KEY=your-key
 * 
 * 2. Via Dashboard:
 *    Go to Settings > Edge Functions > Secrets
 *    Add each secret with its value
 * 
 * 3. Via API:
 *    Use Supabase Management API
 */

