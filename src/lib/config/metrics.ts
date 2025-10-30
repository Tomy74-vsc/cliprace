/**
 * Optimized Metrics Collection Configuration
 * 
 * Centralized configuration for all metrics collection components
 * with environment-based settings and performance optimizations
 */

export interface MetricsConfig {
  // Rate limiting per platform
  rateLimits: {
    youtube: number;
    tiktok: number;
    instagram: number;
  };
  
  // Refresh intervals in minutes
  refreshIntervals: {
    youtube: number;
    tiktok: number;
    instagram: number;
  };
  
  // Batch processing
  batchSize: number;
  maxRetries: number;
  retryDelay: number;
  
  // Performance settings
  cache: {
    enabled: boolean;
    ttl: number; // seconds
    maxSize: number;
  };
  
  // Monitoring
  monitoring: {
    enabled: boolean;
    sampleRate: number; // 0-1
    alertThresholds: {
      errorRate: number; // 0-1
      responseTime: number; // ms
    };
  };
}

export interface PlatformConfig {
  name: string;
  apiKey: string;
  baseUrl: string;
  rateLimit: number;
  refreshInterval: number;
  retryConfig: {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
  };
}

// Environment-based configuration
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

export const METRICS_CONFIG: MetricsConfig = {
  rateLimits: {
    youtube: parseInt(process.env.YOUTUBE_RATE_LIMIT || '5'),
    tiktok: parseInt(process.env.TIKTOK_RATE_LIMIT || '3'),
    instagram: parseInt(process.env.INSTAGRAM_RATE_LIMIT || '3'),
  },
  
  refreshIntervals: {
    youtube: parseInt(process.env.YOUTUBE_REFRESH_INTERVAL || '5'),
    tiktok: parseInt(process.env.TIKTOK_REFRESH_INTERVAL || '10'),
    instagram: parseInt(process.env.INSTAGRAM_REFRESH_INTERVAL || '15'),
  },
  
  batchSize: parseInt(process.env.METRICS_BATCH_SIZE || '50'),
  maxRetries: parseInt(process.env.METRICS_MAX_RETRIES || '3'),
  retryDelay: parseInt(process.env.METRICS_RETRY_DELAY || '1000'),
  
  cache: {
    enabled: process.env.METRICS_CACHE_ENABLED === 'true',
    ttl: parseInt(process.env.METRICS_CACHE_TTL || '300'), // 5 minutes
    maxSize: parseInt(process.env.METRICS_CACHE_MAX_SIZE || '1000'),
  },
  
  monitoring: {
    enabled: process.env.METRICS_MONITORING_ENABLED === 'true',
    sampleRate: parseFloat(process.env.METRICS_SAMPLE_RATE || '0.1'),
    alertThresholds: {
      errorRate: parseFloat(process.env.METRICS_ERROR_THRESHOLD || '0.1'),
      responseTime: parseInt(process.env.METRICS_RESPONSE_THRESHOLD || '5000'),
    },
  },
};

// Platform-specific configurations
export const PLATFORM_CONFIGS: Record<string, PlatformConfig> = {
  youtube: {
    name: 'YouTube',
    apiKey: process.env.YOUTUBE_API_KEY || '',
    baseUrl: 'https://www.googleapis.com/youtube/v3',
    rateLimit: METRICS_CONFIG.rateLimits.youtube,
    refreshInterval: METRICS_CONFIG.refreshIntervals.youtube,
    retryConfig: {
      maxRetries: METRICS_CONFIG.maxRetries,
      baseDelay: METRICS_CONFIG.retryDelay,
      maxDelay: METRICS_CONFIG.retryDelay * 10,
    },
  },
  
  tiktok: {
    name: 'TikTok',
    apiKey: process.env.TIKTOK_CLIENT_ID || '',
    baseUrl: 'https://open-api.tiktok.com',
    rateLimit: METRICS_CONFIG.rateLimits.tiktok,
    refreshInterval: METRICS_CONFIG.refreshIntervals.tiktok,
    retryConfig: {
      maxRetries: METRICS_CONFIG.maxRetries,
      baseDelay: METRICS_CONFIG.retryDelay,
      maxDelay: METRICS_CONFIG.retryDelay * 10,
    },
  },
  
  instagram: {
    name: 'Instagram',
    apiKey: process.env.INSTAGRAM_APP_ID || '',
    baseUrl: 'https://graph.instagram.com',
    rateLimit: METRICS_CONFIG.rateLimits.instagram,
    refreshInterval: METRICS_CONFIG.refreshIntervals.instagram,
    retryConfig: {
      maxRetries: METRICS_CONFIG.maxRetries,
      baseDelay: METRICS_CONFIG.retryDelay,
      maxDelay: METRICS_CONFIG.retryDelay * 10,
    },
  },
};

// Database configuration
export const DATABASE_CONFIG = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  anonKey: process.env.SUPABASE_ANON_KEY || '',
  
  // Connection settings
  connection: {
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10'),
    idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
    connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000'),
  },
  
  // Query settings
  query: {
    timeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000'),
    retryAttempts: parseInt(process.env.DB_RETRY_ATTEMPTS || '3'),
  },
};

// Webhook configuration
export const WEBHOOK_CONFIG = {
  secrets: {
    youtube: process.env.YOUTUBE_WEBHOOK_SECRET || '',
    tiktok: process.env.TIKTOK_WEBHOOK_SECRET || '',
    instagram: process.env.INSTAGRAM_WEBHOOK_SECRET || '',
  },
  
  endpoints: {
    youtube: '/api/metrics/webhook?platform=youtube',
    tiktok: '/api/metrics/webhook?platform=tiktok',
    instagram: '/api/metrics/webhook?platform=instagram',
  },
  
  // Security settings
  security: {
    signatureVerification: process.env.WEBHOOK_SIGNATURE_VERIFICATION === 'true',
    rateLimitPerIP: parseInt(process.env.WEBHOOK_RATE_LIMIT_PER_IP || '100'),
    rateLimitWindow: parseInt(process.env.WEBHOOK_RATE_LIMIT_WINDOW || '3600'), // 1 hour
  },
};

// Logging configuration
export const LOGGING_CONFIG = {
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  format: process.env.LOG_FORMAT || (isProduction ? 'json' : 'pretty'),
  
  // File logging (for production)
  file: {
    enabled: isProduction,
    path: process.env.LOG_FILE_PATH || './logs/metrics.log',
    maxSize: process.env.LOG_MAX_SIZE || '10MB',
    maxFiles: parseInt(process.env.LOG_MAX_FILES || '5'),
  },
  
  // Console logging
  console: {
    enabled: !isProduction,
    colors: !isProduction,
  },
  
  // Structured logging
  structured: {
    enabled: isProduction,
    includeStack: isDevelopment,
    includeContext: true,
  },
};

// Performance monitoring configuration
export const PERFORMANCE_CONFIG = {
  enabled: process.env.PERFORMANCE_MONITORING === 'true',
  
  // Metrics collection
  metrics: {
    enabled: true,
    sampleRate: parseFloat(process.env.PERFORMANCE_SAMPLE_RATE || '1.0'),
    collectionInterval: parseInt(process.env.PERFORMANCE_COLLECTION_INTERVAL || '60000'), // 1 minute
  },
  
  // Memory monitoring
  memory: {
    enabled: true,
    threshold: parseFloat(process.env.MEMORY_THRESHOLD || '0.8'), // 80%
    gcInterval: parseInt(process.env.GC_INTERVAL || '300000'), // 5 minutes
  },
  
  // Request monitoring
  requests: {
    enabled: true,
    slowRequestThreshold: parseInt(process.env.SLOW_REQUEST_THRESHOLD || '1000'), // 1 second
    timeoutThreshold: parseInt(process.env.REQUEST_TIMEOUT_THRESHOLD || '30000'), // 30 seconds
  },
};

// Validation function
export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check required environment variables
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'YOUTUBE_API_KEY',
  ];
  
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      errors.push(`Missing required environment variable: ${varName}`);
    }
  }
  
  // Validate numeric values
  if (METRICS_CONFIG.batchSize <= 0) {
    errors.push('batchSize must be greater than 0');
  }
  
  if (METRICS_CONFIG.maxRetries < 0) {
    errors.push('maxRetries must be non-negative');
  }
  
  if (METRICS_CONFIG.retryDelay <= 0) {
    errors.push('retryDelay must be greater than 0');
  }
  
  // Validate rate limits
  for (const [platform, limit] of Object.entries(METRICS_CONFIG.rateLimits)) {
    if (limit <= 0) {
      errors.push(`${platform} rate limit must be greater than 0`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// Export default configuration
export default METRICS_CONFIG;
