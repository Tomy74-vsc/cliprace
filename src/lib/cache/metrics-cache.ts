/**
 * Optimized Metrics Cache System
 * 
 * Provides intelligent caching for metrics data with:
 * - TTL-based expiration
 * - Memory-efficient storage
 * - Platform-specific cache strategies
 * - Cache invalidation
 */

import { logger } from '@/lib/logger';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  platform: string;
  submissionId: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  memoryUsage: number;
}

class MetricsCache {
  private cache = new Map<string, CacheEntry<any>>();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    size: 0,
    memoryUsage: 0,
  };
  
  private maxSize: number;
  private defaultTTL: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(maxSize: number = 1000, defaultTTL: number = 300000) { // 5 minutes default
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
    this.startCleanup();
  }

  private startCleanup(): void {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  private generateKey(platform: string, submissionId: string, operation: string): string {
    return `${platform}:${submissionId}:${operation}`;
  }

  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private cleanup(): void {
    const now = Date.now();
    let evicted = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        evicted++;
      }
    }

    if (evicted > 0) {
      this.stats.evictions += evicted;
      logger.debug(`Cache cleanup: evicted ${evicted} expired entries`);
    }
  }

  private evictLRU(): void {
    if (this.cache.size <= this.maxSize) return;

    // Simple LRU: remove oldest entries
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

    const toRemove = entries.slice(0, Math.floor(this.maxSize * 0.1)); // Remove 10%
    
    for (const [key] of toRemove) {
      this.cache.delete(key);
      this.stats.evictions++;
    }

    logger.debug(`Cache eviction: removed ${toRemove.length} entries`);
  }

  public get<T>(platform: string, submissionId: string, operation: string): T | null {
    const key = this.generateKey(platform, submissionId, operation);
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.evictions++;
      return null;
    }

    this.stats.hits++;
    return entry.data as T;
  }

  public set<T>(
    platform: string, 
    submissionId: string, 
    operation: string, 
    data: T, 
    ttl?: number
  ): void {
    const key = this.generateKey(platform, submissionId, operation);
    
    // Evict if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
      platform,
      submissionId,
    };

    this.cache.set(key, entry);
    this.updateStats();
  }

  public invalidate(platform: string, submissionId?: string): void {
    if (submissionId) {
      // Invalidate specific submission
      const keysToDelete: string[] = [];
      for (const [key, entry] of this.cache.entries()) {
        if (entry.platform === platform && entry.submissionId === submissionId) {
          keysToDelete.push(key);
        }
      }
      
      for (const key of keysToDelete) {
        this.cache.delete(key);
      }
      
      logger.debug(`Cache invalidation: removed ${keysToDelete.length} entries for ${platform}:${submissionId}`);
    } else {
      // Invalidate all entries for platform
      const keysToDelete: string[] = [];
      for (const [key, entry] of this.cache.entries()) {
        if (entry.platform === platform) {
          keysToDelete.push(key);
        }
      }
      
      for (const key of keysToDelete) {
        this.cache.delete(key);
      }
      
      logger.debug(`Cache invalidation: removed ${keysToDelete.length} entries for ${platform}`);
    }
    
    this.updateStats();
  }

  public clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.updateStats();
    logger.info(`Cache cleared: removed ${size} entries`);
  }

  private updateStats(): void {
    this.stats.size = this.cache.size;
    this.stats.memoryUsage = this.estimateMemoryUsage();
  }

  private estimateMemoryUsage(): number {
    let totalSize = 0;
    for (const [key, entry] of this.cache.entries()) {
      totalSize += key.length * 2; // UTF-16 characters
      totalSize += JSON.stringify(entry).length * 2;
    }
    return totalSize;
  }

  public getStats(): CacheStats {
    return { ...this.stats };
  }

  public getHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    return total === 0 ? 0 : this.stats.hits / total;
  }

  public getSize(): number {
    return this.cache.size;
  }

  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }
}

// Platform-specific cache strategies
export class PlatformCacheStrategy {
  private cache: MetricsCache;
  private platformTTLs: Record<string, number>;

  constructor() {
    this.cache = new MetricsCache();
    this.platformTTLs = {
      youtube: 300000,    // 5 minutes
      tiktok: 600000,     // 10 minutes
      instagram: 900000,  // 15 minutes
    };
  }

  public getMetrics(platform: string, submissionId: string): any | null {
    return this.cache.get(platform, submissionId, 'metrics');
  }

  public setMetrics(platform: string, submissionId: string, metrics: any): void {
    const ttl = this.platformTTLs[platform] || 300000;
    this.cache.set(platform, submissionId, 'metrics', metrics, ttl);
  }

  public getConfig(platform: string, creatorId: string): any | null {
    return this.cache.get(platform, creatorId, 'config');
  }

  public setConfig(platform: string, creatorId: string, config: any): void {
    // Config cache lasts longer (1 hour)
    this.cache.set(platform, creatorId, 'config', config, 3600000);
  }

  public invalidateSubmission(platform: string, submissionId: string): void {
    this.cache.invalidate(platform, submissionId);
  }

  public invalidatePlatform(platform: string): void {
    this.cache.invalidate(platform);
  }

  public getStats(): CacheStats {
    return this.cache.getStats();
  }

  public clear(): void {
    this.cache.clear();
  }

  public destroy(): void {
    this.cache.destroy();
  }
}

// Singleton instance
export const metricsCache = new PlatformCacheStrategy();

// Cache middleware for API calls
export function withCache<T>(
  platform: string,
  submissionId: string,
  operation: string,
  fetchFn: () => Promise<T>,
  ttl?: number
): Promise<T> {
  const cached = metricsCache.getMetrics(platform, submissionId);
  if (cached) {
    logger.debug(`Cache hit for ${platform}:${submissionId}:${operation}`);
    return Promise.resolve(cached);
  }

  logger.debug(`Cache miss for ${platform}:${submissionId}:${operation}`);
  
  return fetchFn().then(result => {
    metricsCache.setMetrics(platform, submissionId, result);
    return result;
  });
}

// Cache warming utilities
export class CacheWarmer {
  private cache: PlatformCacheStrategy;

  constructor(cache: PlatformCacheStrategy) {
    this.cache = cache;
  }

  public async warmSubmissionCache(
    platform: string,
    submissionIds: string[],
    fetchFn: (id: string) => Promise<any>
  ): Promise<void> {
    logger.info(`Warming cache for ${submissionIds.length} ${platform} submissions`);
    
    const promises = submissionIds.map(async (id) => {
      try {
        const data = await fetchFn(id);
        this.cache.setMetrics(platform, id, data);
      } catch (error) {
        logger.warn(`Failed to warm cache for ${platform}:${id}`, { error });
      }
    });

    await Promise.allSettled(promises);
    logger.info(`Cache warming completed for ${platform}`);
  }

  public async warmConfigCache(
    platform: string,
    creatorIds: string[],
    fetchFn: (id: string) => Promise<any>
  ): Promise<void> {
    logger.info(`Warming config cache for ${creatorIds.length} ${platform} creators`);
    
    const promises = creatorIds.map(async (id) => {
      try {
        const config = await fetchFn(id);
        this.cache.setConfig(platform, id, config);
      } catch (error) {
        logger.warn(`Failed to warm config cache for ${platform}:${id}`, { error });
      }
    });

    await Promise.allSettled(promises);
    logger.info(`Config cache warming completed for ${platform}`);
  }
}

export const cacheWarmer = new CacheWarmer(metricsCache);
