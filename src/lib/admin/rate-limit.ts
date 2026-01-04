import { NextRequest } from 'next/server';
import { rateLimit } from '@/lib/rateLimit';
import { createError } from '@/lib/errors';

type AdminRateLimitOptions = {
  route: string;
  max?: number;
  windowMs?: number;
};

export async function enforceAdminRateLimit(req: NextRequest, options: AdminRateLimitOptions) {
  const ip = req.headers.get('x-forwarded-for') || (req as any).ip || 'unknown';
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
