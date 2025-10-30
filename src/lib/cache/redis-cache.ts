/**
 * Système de cache Redis pour ClipRace
 * Cache intelligent pour les requêtes fréquentes avec invalidation automatique
 */

// Configuration du cache
export const cacheConfig = {
  // Durées de cache par type de données
  ttl: {
    contests: 300,        // 5 minutes
    leaderboards: 60,     // 1 minute
    profiles: 600,        // 10 minutes
    submissions: 120,     // 2 minutes
    metrics: 30,          // 30 secondes
    static: 3600,         // 1 heure
  },
  
  // Clés de cache
  keys: {
    contests: (id?: string) => id ? `contest:${id}` : 'contests:all',
    leaderboards: (contestId: string) => `leaderboard:${contestId}`,
    profiles: (id: string) => `profile:${id}`,
    submissions: (contestId: string) => `submissions:${contestId}`,
    metrics: (submissionId: string) => `metrics:${submissionId}`,
  },
  
  // Configuration Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
  }
};

// Interface pour les données mises en cache
interface CacheData<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

// Store en mémoire pour le développement (à remplacer par Redis en production)
const memoryCache = new Map<string, CacheData<any>>();

/**
 * Classe de gestion du cache
 */
export class CacheManager {
  private static instance: CacheManager;
  
  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }
  
  /**
   * Récupère des données du cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      // En développement, utiliser le cache mémoire
      if (process.env.NODE_ENV === 'development') {
        const cached = memoryCache.get(key);
        if (!cached) return null;
        
        // Vérifier l'expiration
        if (Date.now() - cached.timestamp > cached.ttl * 1000) {
          memoryCache.delete(key);
          return null;
        }
        
        return cached.data;
      }
      
      // En production, utiliser Redis
      // TODO: Implémenter la connexion Redis réelle
      return null;
    } catch (error) {
      console.error('Erreur lors de la récupération du cache:', error);
      return null;
    }
  }
  
  /**
   * Stocke des données dans le cache
   */
  async set<T>(key: string, data: T, ttl: number): Promise<void> {
    try {
      // En développement, utiliser le cache mémoire
      if (process.env.NODE_ENV === 'development') {
        memoryCache.set(key, {
          data,
          timestamp: Date.now(),
          ttl: ttl * 1000,
        });
        return;
      }
      
      // En production, utiliser Redis
      // TODO: Implémenter la connexion Redis réelle
    } catch (error) {
      console.error('Erreur lors du stockage en cache:', error);
    }
  }
  
  /**
   * Supprime des données du cache
   */
  async delete(key: string): Promise<void> {
    try {
      if (process.env.NODE_ENV === 'development') {
        memoryCache.delete(key);
        return;
      }
      
      // TODO: Implémenter la suppression Redis
    } catch (error) {
      console.error('Erreur lors de la suppression du cache:', error);
    }
  }
  
  /**
   * Supprime les clés correspondant à un pattern
   */
  async deletePattern(pattern: string): Promise<void> {
    try {
      if (process.env.NODE_ENV === 'development') {
        const regex = new RegExp(pattern.replace('*', '.*'));
        for (const key of memoryCache.keys()) {
          if (regex.test(key)) {
            memoryCache.delete(key);
          }
        }
        return;
      }
      
      // TODO: Implémenter la suppression par pattern Redis
    } catch (error) {
      console.error('Erreur lors de la suppression par pattern:', error);
    }
  }
  
  /**
   * Vide tout le cache
   */
  async clear(): Promise<void> {
    try {
      if (process.env.NODE_ENV === 'development') {
        memoryCache.clear();
        return;
      }
      
      // TODO: Implémenter le vidage Redis
    } catch (error) {
      console.error('Erreur lors du vidage du cache:', error);
    }
  }
}

/**
 * Hook pour utiliser le cache dans les composants
 */
export function useCache() {
  const cache = CacheManager.getInstance();
  
  return {
    get: cache.get.bind(cache),
    set: cache.set.bind(cache),
    delete: cache.delete.bind(cache),
    deletePattern: cache.deletePattern.bind(cache),
    clear: cache.clear.bind(cache),
  };
}

/**
 * Fonction utilitaire pour wrapper les requêtes avec cache
 */
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = 300
): Promise<T> {
  const cache = CacheManager.getInstance();
  
  // Essayer de récupérer du cache
  const cached = await cache.get<T>(key);
  if (cached) {
    return cached;
  }
  
  // Exécuter la fonction et mettre en cache
  const data = await fetcher();
  await cache.set(key, data, ttl);
  
  return data;
}

/**
 * Invalidation intelligente du cache
 */
export async function invalidateCache(type: string, id?: string): Promise<void> {
  const cache = CacheManager.getInstance();
  
  switch (type) {
    case 'contest':
      if (id) {
        await cache.delete(cacheConfig.keys.contests(id));
        await cache.deletePattern('contests:*');
      }
      await cache.deletePattern('leaderboard:*');
      break;
      
    case 'submission':
      if (id) {
        await cache.delete(cacheConfig.keys.metrics(id));
      }
      await cache.deletePattern('submissions:*');
      await cache.deletePattern('leaderboard:*');
      break;
      
    case 'profile':
      if (id) {
        await cache.delete(cacheConfig.keys.profiles(id));
      }
      break;
      
    default:
      await cache.clear();
  }
}
