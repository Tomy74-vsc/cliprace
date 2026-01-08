import { NextRequest } from 'next/server';
import { rateLimit } from '@/lib/rateLimit';
import { createError } from '@/lib/errors';

type AdminRateLimitOptions = {
  route: string;
  max?: number;
  windowMs?: number;
};

export async function enforceAdminRateLimit(
  req: NextRequest,
  options: AdminRateLimitOptions,
  userId?: string
) {
  // Limite globale par admin (si userId fourni)
  if (userId) {
    const globalKey = `admin:global:${userId}`;
    const globalOk = await rateLimit({
      key: globalKey,
      route: 'admin:global',
      windowMs: 60 * 60 * 1000, // 1 heure
      max: 1000, // 1000 requêtes/heure par admin
    });

    if (!globalOk) {
      throw createError(
        'RATE_LIMIT',
        'Too many requests (global limit: 1000/hour)',
        429
      );
    }
  }

  // Limite par route
  const ip = req.headers.get('x-forwarded-for') || (req as UnsafeAny).ip || 'unknown';
  const key = `${options.route}:${ip}`;
  const ok = await rateLimit({
    key,
    route: options.route,
    windowMs: options.windowMs ?? 60_000,
    max: options.max ?? 30,
  });

  if (!ok) {
    throw createError('RATE_LIMIT', 'Too many requests', 429);
  }
}

