/**
 * Brand rate limiter — in-memory Map with SHA-256 keying.
 * Mirrors the admin rate-limit pattern but with brand-specific limits
 * and an in-process store (no DB round-trip on hot paths).
 *
 * Limits:
 *   - Critical routes (publish/payment/cashout) : 10 req/min
 *   - Standard routes (update/create)           : 30 req/min
 *   - Read-enriched routes (export/bulk)        : 5 req/min
 *   - Global per-user ceiling                   : 300 req/min
 */
import { createHash } from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

type WindowEntry = { count: number; resetAt: number };

export type BrandRateLimitOptions = {
  /** Max requests in the time window (default: 30). */
  limit?: number;
  /** Window duration in milliseconds (default: 60 000). */
  window?: number;
};

// ─── Route presets ────────────────────────────────────────────────────────────

/** 10 req/min — publish, payment, cashout */
export const BRAND_LIMIT_CRITICAL: BrandRateLimitOptions = { limit: 10, window: 60_000 };
/** 30 req/min — update, create (default) */
export const BRAND_LIMIT_STANDARD: BrandRateLimitOptions = { limit: 30, window: 60_000 };
/** 5 req/min  — export, bulk */
export const BRAND_LIMIT_READ_ENRICHED: BrandRateLimitOptions = { limit: 5, window: 60_000 };

// ─── In-memory store ──────────────────────────────────────────────────────────

const store = new Map<string, WindowEntry>();

// Cleanup expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getClientIp(req: Request): string {
  const vercel = (req.headers as Headers).get('x-vercel-forwarded-for');
  if (vercel) return vercel.split(',')[0]?.trim() ?? 'unknown';
  const xff = (req.headers as Headers).get('x-forwarded-for');
  if (xff) return xff.split(',')[0]?.trim() ?? 'unknown';
  return 'unknown';
}

function buildKey(userId: string, ip: string, route: string): string {
  return createHash('sha256').update(`${userId}:${ip}:${route}`).digest('hex');
}

function checkLimit(key: string, limit: number, windowMs: number): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }

  if (entry.count >= limit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }

  entry.count += 1;
  return { allowed: true, retryAfter: 0 };
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Enforce brand rate limits. Throws a 429 Response if the limit is exceeded.
 *
 * Usage in route handlers:
 * ```ts
 * await enforceBrandRateLimit(req, user.id)
 * await enforceBrandRateLimit(req, user.id, BRAND_LIMIT_CRITICAL)
 * ```
 */
export async function enforceBrandRateLimit(
  req: Request,
  userId: string,
  options?: BrandRateLimitOptions,
): Promise<void> {
  const ip = getClientIp(req);
  const url = new URL(req.url);
  const route = url.pathname;
  const windowMs = options?.window ?? 60_000;
  const limit = options?.limit ?? 30;

  // 1. Global ceiling: 300 req/min per user
  const globalKey = buildKey(userId, ip, 'brand:global');
  const global_ = checkLimit(globalKey, 300, 60_000);
  if (!global_.allowed) {
    throw new Response(
      JSON.stringify({ error: 'Too Many Requests', code: 'RATE_LIMIT' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(global_.retryAfter),
        },
      },
    );
  }

  // 2. Per-route limit
  const routeKey = buildKey(userId, ip, route);
  const route_ = checkLimit(routeKey, limit, windowMs);
  if (!route_.allowed) {
    throw new Response(
      JSON.stringify({ error: 'Too Many Requests', code: 'RATE_LIMIT' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(route_.retryAfter),
        },
      },
    );
  }
}
