# 📊 Platform Connectors & Metrics Collection

## 🎯 Overview

This directory contains platform-specific connectors for fetching video metrics from various social media platforms. The system supports real-time metrics collection through both scheduled polling and webhook notifications.

## 🏗️ Architecture

### Components

1. **Connectors** (`/connectors/`) - Platform-specific API clients
2. **Metrics Poller** (`/functions/metrics-poller/`) - Scheduled metrics collection
3. **Webhook Endpoint** (`/api/metrics/webhook/`) - Real-time notifications
4. **Scheduler** - Cron jobs for triggering the poller

### Data Flow

```
Platform APIs → Connectors → Metrics Poller → Database
     ↓              ↓            ↓
Webhooks → Webhook Endpoint → Database
```

## 🔌 Supported Platforms

### ✅ YouTube (Implemented)
- **API**: YouTube Data API v3
- **Authentication**: API Key + OAuth (for private videos)
- **Rate Limit**: 10,000 units/day (free tier)
- **Refresh Interval**: 5 minutes
- **Webhooks**: PubSubHubbub support

### 🚧 TikTok (Planned)
- **API**: TikTok Business API
- **Authentication**: OAuth 2.0
- **Rate Limit**: 100 requests/hour (basic tier)
- **Refresh Interval**: 10 minutes
- **Webhooks**: Supported

### 🚧 Instagram (Planned)
- **API**: Instagram Graph API
- **Authentication**: OAuth 2.0
- **Rate Limit**: 200 requests/hour per user
- **Refresh Interval**: 15 minutes
- **Webhooks**: Supported

## ⚙️ Configuration

### Environment Variables

```bash
# YouTube
YOUTUBE_API_KEY=your_api_key
YOUTUBE_CLIENT_ID=your_client_id
YOUTUBE_CLIENT_SECRET=your_client_secret
YOUTUBE_WEBHOOK_SECRET=your_webhook_secret

# TikTok
TIKTOK_CLIENT_ID=your_client_id
TIKTOK_CLIENT_SECRET=your_client_secret
TIKTOK_WEBHOOK_SECRET=your_webhook_secret

# Instagram
INSTAGRAM_APP_ID=your_app_id
INSTAGRAM_APP_SECRET=your_app_secret
INSTAGRAM_WEBHOOK_SECRET=your_webhook_secret
```

### Database Schema

The system uses the following tables:

- `submissions` - Stores video submissions with current metrics
- `metrics_daily` - Historical daily metrics for trend analysis
- `profiles.social_media` - Encrypted OAuth tokens per creator

## 🔄 Refresh Strategies

### Platform-Specific Intervals

| Platform | Interval | Reason |
|----------|----------|---------|
| YouTube | 5 minutes | High update frequency, good API limits |
| TikTok | 10 minutes | Moderate limits, good for engagement tracking |
| Instagram | 15 minutes | Stricter limits, slower metric updates |

### Adaptive Refresh

The system can adjust refresh intervals based on:
- Video age (newer videos refresh more frequently)
- Engagement rate (high-performing content gets priority)
- Platform-specific rate limits
- Creator subscription tier

## 🔐 OAuth Scopes Required

### YouTube
```
- https://www.googleapis.com/auth/youtube.readonly
- https://www.googleapis.com/auth/youtube.force-ssl
```

### TikTok Business
```
- user.info.basic (read user profile)
- video.list (read user's videos)
- video.publish (publish videos - if needed)
```

### Instagram Graph
```
- instagram_basic (read basic profile)
- instagram_content_publish (publish content - if needed)
- pages_read_engagement (read page insights)
```

## 🚀 Deployment

### 1. Supabase Edge Functions

Deploy the metrics poller as a Supabase Edge Function:

```bash
# Deploy the function
supabase functions deploy metrics-poller

# Set up cron schedule (every 5 minutes)
supabase functions deploy --schedule "*/5 * * * *" metrics-poller
```

### 2. Vercel Cron Jobs

For Vercel deployment, use Vercel Cron:

```typescript
// vercel.json
{
  "crons": [
    {
      "path": "/api/metrics/poller",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

### 3. Webhook Configuration

Configure webhooks in each platform's developer console:

#### YouTube PubSubHubbub
```
Topic URL: https://your-domain.com/api/metrics/webhook?platform=youtube
Callback URL: https://your-domain.com/api/metrics/webhook
```

#### TikTok Webhooks
```
Webhook URL: https://your-domain.com/api/metrics/webhook
Events: video.insights, video.publish
```

#### Instagram Webhooks
```
Webhook URL: https://your-domain.com/api/metrics/webhook
Events: instagram_video_insights
```

## 📊 Rate Limiting & Backoff

### Rate Limits

| Platform | Limit | Strategy |
|----------|-------|----------|
| YouTube | 10,000 units/day | Batch requests, cache responses |
| TikTok | 100 req/hour | Queue requests, exponential backoff |
| Instagram | 200 req/hour/user | User-based queuing |

### Backoff Strategy

```typescript
// Exponential backoff with jitter
const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
```

### Error Handling

- **429 (Rate Limited)**: Exponential backoff
- **401 (Unauthorized)**: Refresh OAuth token
- **404 (Not Found)**: Mark submission as inactive
- **500 (Server Error)**: Retry with backoff

## 🔍 Monitoring & Observability

### Metrics Tracked

- **API Response Times**: Per platform, per endpoint
- **Error Rates**: By error type and platform
- **Rate Limit Usage**: Current vs. available quota
- **Webhook Delivery**: Success/failure rates

### Alerts

- Rate limit approaching 80% of quota
- OAuth token expiration (7 days before expiry)
- Webhook delivery failures
- Database connection issues

## 🧪 Testing

### Unit Tests

```bash
# Test YouTube connector
npm test -- --grep "YouTube"

# Test metrics poller
npm test -- --grep "Metrics Poller"
```

### Integration Tests

```bash
# Test with real API keys (use test environment)
npm run test:integration:metrics
```

### Load Testing

```bash
# Test rate limiting and backoff
npm run test:load:metrics
```

## 🛠️ Development

### Adding a New Platform

1. Create connector file: `src/services/connectors/{platform}.ts`
2. Implement required interfaces:
   - `fetchVideoMetrics(platformVideoId, config)`
   - `refreshToken(refreshToken)`
   - `getConfig(creatorId)`
3. Add to metrics poller
4. Configure webhook endpoint
5. Update documentation

### Testing Locally

```bash
# Start local development server
npm run dev

# Test webhook endpoint
curl -X POST http://localhost:3000/api/metrics/webhook \
  -H "Content-Type: application/json" \
  -H "x-platform: youtube" \
  -d '{"video_id": "test123", "metrics": {"views": 1000}}'
```

## 📈 Performance Optimization

### Caching Strategy

- **API Responses**: Cache for 1-5 minutes based on platform
- **OAuth Tokens**: Cache until near expiration
- **Video Metadata**: Cache for 1 hour

### Batch Processing

- Group requests by platform
- Use platform-specific batch APIs where available
- Implement request queuing for rate-limited platforms

### Database Optimization

- Index on `submissions.platform_video_id`
- Index on `metrics_daily.date`
- Partition `metrics_daily` by month for large datasets

## 🔒 Security Considerations

### OAuth Token Storage

- Encrypt tokens using Supabase Vault
- Rotate encryption keys regularly
- Implement token refresh before expiration

### Webhook Security

- Verify HMAC signatures
- Implement replay attack protection
- Rate limit webhook endpoints

### API Key Management

- Rotate API keys quarterly
- Use environment-specific keys
- Monitor key usage and anomalies

## 📚 Additional Resources

- [YouTube Data API Documentation](https://developers.google.com/youtube/v3)
- [TikTok Business API Documentation](https://developers.tiktok.com/doc/)
- [Instagram Graph API Documentation](https://developers.facebook.com/docs/instagram-api/)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
