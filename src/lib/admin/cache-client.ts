'use client';

import { adminCache, cacheKey, CACHE_TTL } from './cache';

/**
 * Fetch avec cache pour les composants client
 * 
 * @example
 * const data = await fetchWithCache('/api/admin/users', { page: 1 }, CACHE_TTL.MEDIUM);
 */
export async function fetchWithCache<T>(
  url: string,
  params: Record<string, string | number | boolean> = {},
  ttl: number = CACHE_TTL.MEDIUM
): Promise<T> {
  const key = cacheKey(url, params);
  
  // Vérifier le cache
  const cached = adminCache.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Construire l'URL avec les paramètres
  const urlObj = new URL(url, window.location.origin);
  Object.entries(params).forEach(([k, v]) => {
    urlObj.searchParams.set(k, String(v));
  });

  // Fetch
  const res = await fetch(urlObj.toString(), {
    credentials: 'include',
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch: ${res.statusText}`);
  }

  const data = (await res.json()) as T;
  
  // Mettre en cache
  adminCache.set(key, data, ttl);
  
  return data;
}

/**
 * Invalide le cache pour une URL spécifique
 */
export function invalidateCache(url: string, params: Record<string, string | number | boolean> = {}): void {
  const key = cacheKey(url, params);
  adminCache.delete(key);
}

/**
 * Invalide toutes les clés qui commencent par un préfixe
 */
export function invalidateCachePrefix(prefix: string): void {
  adminCache.invalidatePrefix(prefix);
}

