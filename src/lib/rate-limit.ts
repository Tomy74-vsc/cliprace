/**
 * Rate Limiting System
 * Implémentation d'un système de rate limiting en mémoire pour les endpoints sensibles
 * Support Redis optionnel pour les déploiements multi-instance
 */


// Interface pour le stockage persistant (Redis)
interface RateLimitStore {
  get(key: string): Promise<RateLimitEntry | null>;
  set(key: string, value: RateLimitEntry, ttl: number): Promise<void>;
  delete(key: string): Promise<void>;
  cleanup(): Promise<void>;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

// Store en mémoire pour le rate limiting
const rateLimitStore = new Map<string, RateLimitEntry>();

// Store persistant (Redis) - optionnel
let persistentStore: RateLimitStore | null = null;

/**
 * Initialise le store persistant Redis (optionnel)
 */
export async function initPersistentRateLimit(redisUrl?: string): Promise<void> {
  if (!redisUrl) {
    console.log('Rate limiting: Mode mémoire (pas de Redis configuré)');
    return;
  }

  try {
    // Import dynamique de Redis (optionnel)
    const Redis = await import('redis' as any).catch(() => null);
    if (!Redis) {
      throw new Error('Redis module not available');
    }
    const client = (Redis as any).createClient({ url: redisUrl });
    await client.connect();

    persistentStore = {
      async get(key: string): Promise<RateLimitEntry | null> {
        const value = await client.get(key);
        return value ? JSON.parse(value) : null;
      },
      async set(key: string, value: RateLimitEntry, ttl: number): Promise<void> {
        await client.setEx(key, Math.ceil(ttl / 1000), JSON.stringify(value));
      },
      async delete(key: string): Promise<void> {
        await client.del(key);
      },
      async cleanup(): Promise<void> {
        // Redis gère automatiquement l'expiration
      }
    };

    console.log('Rate limiting: Mode Redis activé');
  } catch (error) {
    console.warn('Rate limiting: Redis non disponible, utilisation du mode mémoire', error);
  }
}

// Configuration par endpoint
const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  '/api/auth/check-email': {
    maxRequests: 10, // 10 requêtes
    windowMs: 60 * 1000, // par minute
  },
  '/api/auth/login': {
    maxRequests: 5, // 5 tentatives de connexion
    windowMs: 60 * 1000, // par minute
  },
  '/api/auth/signup': {
    maxRequests: 5, // 5 tentatives d'inscription
    windowMs: 60 * 1000, // par minute
  },
  '/api/auth/complete-profile': {
    maxRequests: 5,
    windowMs: 60 * 1000,
  },
  '/api/uploads/avatar': {
    maxRequests: 5,
    windowMs: 60 * 1000,
  },
  '/api/auth/forgot-password': {
    maxRequests: 3, // 3 requêtes
    windowMs: 60 * 1000, // par minute
  },
  '/api/auth/reset-password': {
    maxRequests: 5, // 5 requêtes
    windowMs: 60 * 1000, // par minute
  },
  '/api/auth/recaptcha': {
    maxRequests: 10, // 10 requêtes
    windowMs: 60 * 1000, // par minute
  },
  '/api/privacy/export': {
    maxRequests: 2, // 2 requêtes
    windowMs: 60 * 1000, // par minute
  },
  '/api/privacy/delete': {
    maxRequests: 1, // 1 requête
    windowMs: 60 * 1000, // par minute
  },
  '/api/submissions': {
    maxRequests: 10, // 10 soumissions
    windowMs: 60 * 1000, // par minute
  },
  '/api/payments': {
    maxRequests: 5, // 5 paiements
    windowMs: 60 * 1000, // par minute
  },
};

/**
 * Nettoie les entrées expirées du store
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of Array.from(rateLimitStore.entries())) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Génère une clé unique pour le rate limiting basée sur l'IP et l'endpoint
 */
function generateRateLimitKey(ip: string, endpoint: string): string {
  return `${ip}:${endpoint}`;
}

/**
 * Vérifie si une requête respecte les limites de rate limiting
 */
export async function checkRateLimit(
  ip: string,
  endpoint: string,
  overrideConfig?: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  const config = overrideConfig ?? RATE_LIMIT_CONFIGS[endpoint];
  
  if (!config) {
    // Pas de rate limiting pour cet endpoint
    return { allowed: true, remaining: Infinity, resetTime: 0 };
  }

  const key = generateRateLimitKey(ip, endpoint);
  const now = Date.now();

  // Utiliser le store persistant si disponible
  if (persistentStore) {
    try {
      const entry = await persistentStore.get(key);

      if (!entry || now > entry.resetTime) {
        // Nouvelle fenêtre ou entrée expirée
        const newEntry: RateLimitEntry = {
          count: 1,
          resetTime: now + config.windowMs,
        };
        await persistentStore.set(key, newEntry, config.windowMs);
        
        return {
          allowed: true,
          remaining: config.maxRequests - 1,
          resetTime: newEntry.resetTime,
        };
      }

      // Vérifier si la limite est dépassée
      if (entry.count >= config.maxRequests) {
        return {
          allowed: false,
          remaining: 0,
          resetTime: entry.resetTime,
        };
      }

      // Incrémenter le compteur
      entry.count++;
      await persistentStore.set(key, entry, config.windowMs);

      return {
        allowed: true,
        remaining: config.maxRequests - entry.count,
        resetTime: entry.resetTime,
      };
    } catch (error) {
      console.error('Erreur Redis rate limiting, fallback mémoire:', error);
      // Fallback vers le mode mémoire
    }
  }

  // Mode mémoire (fallback ou par défaut)
  // Nettoyer les entrées expirées périodiquement
  if (Math.random() < 0.1) { // 10% de chance de nettoyer
    cleanupExpiredEntries();
  }

  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetTime) {
    // Nouvelle fenêtre ou entrée expirée
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + config.windowMs,
    };
    rateLimitStore.set(key, newEntry);
    
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: newEntry.resetTime,
    };
  }

  // Vérifier si la limite est dépassée
  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
    };
  }

  // Incrémenter le compteur
  entry.count++;
  rateLimitStore.set(key, entry);

  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.resetTime,
  };
}

/**
 * Middleware de rate limiting pour les endpoints
 */
export function withRateLimit(endpoint: string, override?: RateLimitConfig) {
  return function rateLimitMiddleware(
    handler: (request: Request) => Promise<Response>
  ) {
    return async function rateLimitedHandler(request: Request): Promise<Response> {
      // Extraire l'IP de la requête
      const forwarded = request.headers.get('x-forwarded-for');
      const realIp = request.headers.get('x-real-ip');
      const ip = forwarded?.split(',')[0] || realIp || 'unknown';

      const config = override ?? RATE_LIMIT_CONFIGS[endpoint];

      // Vérifier le rate limiting
      const rateLimitResult = await checkRateLimit(ip, endpoint, config);

      if (!rateLimitResult.allowed) {
        const resetTimeSeconds = Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000);
        
        return new Response(
          JSON.stringify({
            error: 'Trop de requêtes. Veuillez réessayer plus tard.',
            retryAfter: resetTimeSeconds,
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'X-RateLimit-Limit': config?.maxRequests?.toString() || '0',
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
              'Retry-After': resetTimeSeconds.toString(),
            },
          }
        );
      }

      // Ajouter les headers de rate limiting à la réponse
      const response = await handler(request);
      
      // Cloner la réponse pour ajouter les headers
      const responseHeaders = new Headers();
      // Copie des en-têtes en préservant TOUTES les occurrences Set-Cookie
      response.headers.forEach((value, key) => {
        if (key.toLowerCase() === 'set-cookie') {
          responseHeaders.append('set-cookie', value);
        } else {
          responseHeaders.set(key, value);
        }
      });
      responseHeaders.set('X-RateLimit-Limit', config?.maxRequests?.toString() || '0');
      responseHeaders.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
      responseHeaders.set('X-RateLimit-Reset', rateLimitResult.resetTime.toString());

      const newResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });

      return newResponse;
    };
  };
}

/**
 * Obtient les statistiques de rate limiting (pour debugging)
 */
export function getRateLimitStats(): Record<string, { active: number; total: number }> {
  const stats: Record<string, { active: number; total: number }> = {};
  
  for (const [key, entry] of Array.from(rateLimitStore.entries())) {
    const endpoint = key.split(':')[1];
    if (!stats[endpoint]) {
      stats[endpoint] = { active: 0, total: 0 };
    }
    
    stats[endpoint].total++;
    if (Date.now() <= entry.resetTime) {
      stats[endpoint].active++;
    }
  }
  
  return stats;
}
