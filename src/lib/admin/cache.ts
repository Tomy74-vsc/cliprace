/**
 * Cache simple en mémoire pour les requêtes admin fréquentes
 * 
 * Ce cache est utilisé pour réduire les appels API répétés et améliorer
 * les performances. Le cache est invalidé automatiquement après un TTL.
 */

type CacheEntry<T> = {
  data: T;
  timestamp: number;
  ttl: number;
};

class AdminCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private inFlight = new Map<string, Promise<unknown>>();
  private defaultTTL = 60_000; // 1 minute par défaut

  /**
   * Récupère une valeur du cache si elle existe et n'est pas expirée
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Stocke une valeur dans le cache avec un TTL optionnel
   */
  set<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl ?? this.defaultTTL,
    });
    this.inFlight.delete(key);
  }

  /**
   * Supprime une clé du cache
   */
  delete(key: string): void {
    this.cache.delete(key);
    this.inFlight.delete(key);
  }

  /**
   * Invalide toutes les clés qui correspondent à un préfixe
   */
  invalidatePrefix(prefix: string): void {
    const keysToDelete: string[] = [];
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach((key) => this.cache.delete(key));
    // Also clear in-flight promises
    for (const key of this.inFlight.keys()) {
      if (key.startsWith(prefix)) this.inFlight.delete(key);
    }
  }

  /**
   * Récupère une valeur du cache ou l'initialise via une factory (anti thundering herd).
   */
  async getOrSet<T>(key: string, factory: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) return cached;

    const existing = this.inFlight.get(key);
    if (existing) return (await existing) as T;

    const promise = (async () => {
      const value = await factory();
      this.set(key, value, ttl);
      return value;
    })().finally(() => {
      // set() also clears inFlight; this is a second safety net
      this.inFlight.delete(key);
    });

    this.inFlight.set(key, promise);
    return (await promise) as T;
  }

  /**
   * Vide tout le cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Nettoie les entrées expirées
   */
  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach((key) => this.cache.delete(key));
  }

  /**
   * Retourne la taille actuelle du cache
   */
  size(): number {
    return this.cache.size;
  }
}

// Instance singleton
export const adminCache = new AdminCache();

// Nettoyage automatique toutes les 5 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    adminCache.cleanup();
  }, 5 * 60_000);
}

/**
 * Helper pour créer une clé de cache standardisée
 */
export function cacheKey(prefix: string, params: Record<string, string | number | boolean>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${key}=${String(params[key])}`)
    .join('&');
  return `${prefix}:${sortedParams}`;
}

/**
 * TTL constants pour différents types de données
 */
export const CACHE_TTL = {
  SHORT: 30_000, // 30 secondes
  MEDIUM: 60_000, // 1 minute
  LONG: 5 * 60_000, // 5 minutes
  VERY_LONG: 15 * 60_000, // 15 minutes
} as const;

