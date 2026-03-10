/**
 * Safe IP extraction for rate limiting and audit logging.
 *
 * Priority:
 * 1. x-vercel-forwarded-for — set by Vercel edge, cannot be spoofed by clients
 * 2. x-forwarded-for — parse first IP (leftmost = original client), trim whitespace
 * 3. Fallback to 'unknown'
 *
 * IMPORTANT: On non-Vercel platforms, x-forwarded-for can be spoofed.
 * For bank-grade security, always combine IP with userId + user-agent in rate-limit keys.
 */

import { NextRequest } from 'next/server';

export function getClientIp(req: NextRequest): string {
  // 1. Vercel platform header (trusted, set by edge network)
  const vercelIp = req.headers.get('x-vercel-forwarded-for');
  if (vercelIp) {
    const first = vercelIp.split(',')[0]?.trim();
    if (first) return first;
  }

  // 2. Standard x-forwarded-for (take first = original client IP)
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }

  // 3. Fallback
  return 'unknown';
}

/**
 * Build a rate-limit key for authenticated routes.
 * Pattern: route:userId:ip:ua(truncated to 64 chars)
 */
export function buildRateLimitKey(
  route: string,
  userId: string,
  req: NextRequest,
): string {
  const ip = getClientIp(req);
  const ua = (req.headers.get('user-agent') || 'unknown').slice(0, 64);
  return `${route}:${userId}:${ip}:${ua}`;
}

/**
 * Build a rate-limit key for unauthenticated routes (auth endpoints).
 * Pattern: route:ip:ua(truncated to 64 chars)
 */
export function buildAnonRateLimitKey(
  route: string,
  req: NextRequest,
): string {
  const ip = getClientIp(req);
  const ua = (req.headers.get('user-agent') || 'unknown').slice(0, 64);
  return `${route}:${ip}:${ua}`;
}
