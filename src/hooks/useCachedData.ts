/**
 * Hook pour utiliser les données mises en cache côté client
 * Intégration avec le système de cache et les requêtes optimisées
 */

import { useState, useEffect, useCallback } from 'react';
import { useCache } from '@/lib/cache/redis-cache';

interface UseCachedDataOptions<T> {
  key: string;
  fetcher: () => Promise<T>;
  ttl?: number;
  enabled?: boolean;
  refetchOnMount?: boolean;
}

interface UseCachedDataReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  invalidate: () => Promise<void>;
}

/**
 * Hook pour récupérer des données avec cache
 */
export function useCachedData<T>({
  key,
  fetcher,
  ttl = 300,
  enabled = true,
  refetchOnMount = true,
}: UseCachedDataOptions<T>): UseCachedDataReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cache = useCache();

  const fetchData = useCallback(async () => {
    if (!enabled) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Essayer de récupérer du cache d'abord
      const cachedData = await cache.get<T>(key);
      
      if (cachedData) {
        setData(cachedData);
        setLoading(false);
        
        // Mettre à jour en arrière-plan si nécessaire
        if (refetchOnMount) {
          try {
            const freshData = await fetcher();
            await cache.set(key, freshData, ttl);
            setData(freshData);
          } catch (err) {
            console.warn('Erreur lors de la mise à jour en arrière-plan:', err);
          }
        }
        return;
      }
      
      // Pas de cache, récupérer les données
      const freshData = await fetcher();
      await cache.set(key, freshData, ttl);
      setData(freshData);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(errorMessage);
      console.error('Erreur lors de la récupération des données:', err);
    } finally {
      setLoading(false);
    }
  }, [key, fetcher, ttl, enabled, refetchOnMount, cache]);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const freshData = await fetcher();
      await cache.set(key, freshData, ttl);
      setData(freshData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [key, fetcher, ttl, cache]);

  const invalidate = useCallback(async () => {
    await cache.delete(key);
    setData(null);
  }, [key, cache]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch,
    invalidate,
  };
}

/**
 * Hook spécialisé pour les concours
 */
export function useContests(options: {
  limit?: number;
  search?: string;
  status?: string;
  enabled?: boolean;
} = {}) {
  const { limit = 20, search, status, enabled = true } = options;
  
  const fetcher = useCallback(async () => {
    const params = new URLSearchParams({
      limit: limit.toString(),
      ...(search && { search }),
      ...(status && { status }),
    });
    
    const response = await fetch(`/api/contests/optimized?${params}`);
    if (!response.ok) {
      throw new Error('Erreur lors de la récupération des concours');
    }
    
    const result = await response.json();
    return result.data;
  }, [limit, search, status]);
  
  return useCachedData({
    key: `contests:${limit}:${search || 'all'}:${status || 'active'}`,
    fetcher,
    ttl: 300, // 5 minutes
    enabled,
  });
}

/**
 * Hook spécialisé pour un concours spécifique
 */
export function useContest(contestId: string, enabled: boolean = true) {
  const fetcher = useCallback(async () => {
    const response = await fetch(`/api/contests/${contestId}`);
    if (!response.ok) {
      throw new Error('Erreur lors de la récupération du concours');
    }
    
    const result = await response.json();
    return result.data;
  }, [contestId]);
  
  return useCachedData({
    key: `contest:${contestId}`,
    fetcher,
    ttl: 300, // 5 minutes
    enabled,
  });
}

/**
 * Hook spécialisé pour les leaderboards
 */
export function useLeaderboard(contestId: string, enabled: boolean = true) {
  const fetcher = useCallback(async () => {
    const response = await fetch(`/api/leaderboards/${contestId}`);
    if (!response.ok) {
      throw new Error('Erreur lors de la récupération du leaderboard');
    }
    
    const result = await response.json();
    return result.data;
  }, [contestId]);
  
  return useCachedData({
    key: `leaderboard:${contestId}`,
    fetcher,
    ttl: 60, // 1 minute
    enabled,
  });
}

/**
 * Hook spécialisé pour les profils
 */
export function useProfile(profileId: string, enabled: boolean = true) {
  const fetcher = useCallback(async () => {
    const response = await fetch(`/api/profiles/${profileId}`);
    if (!response.ok) {
      throw new Error('Erreur lors de la récupération du profil');
    }
    
    const result = await response.json();
    return result.data;
  }, [profileId]);
  
  return useCachedData({
    key: `profile:${profileId}`,
    fetcher,
    ttl: 600, // 10 minutes
    enabled,
  });
}

/**
 * Hook pour les statistiques globales
 */
export function useGlobalStats(enabled: boolean = true) {
  const fetcher = useCallback(async () => {
    const response = await fetch('/api/stats/global');
    if (!response.ok) {
      throw new Error('Erreur lors de la récupération des statistiques');
    }
    
    const result = await response.json();
    return result.data;
  }, []);
  
  return useCachedData({
    key: 'stats:global',
    fetcher,
    ttl: 300, // 5 minutes
    enabled,
  });
}
