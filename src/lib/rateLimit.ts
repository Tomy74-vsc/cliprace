// Source: Persistent rate limiter backed by Supabase (rate_limits table)
import { getSupabaseAdmin } from './supabase/server';

type RateLimitOptions = {
  key: string;
  route: string;
  windowMs: number;
  max: number;
};

export async function rateLimit(options: RateLimitOptions): Promise<boolean> {
  try {
    const admin = getSupabaseAdmin();
    const windowStart = new Date(Date.now() - options.windowMs).toISOString();

    const { count, error } = await admin
      .from('rate_limits')
      .select('id', { count: 'exact', head: true })
      .eq('key', options.key)
      .eq('route', options.route)
      .gte('created_at', windowStart);

    if (error) {
      console.error('rateLimit count error', error);
      return true; // fail-open
    }

    if ((count ?? 0) >= options.max) {
      return false;
    }

    const expiresAt = new Date(Date.now() + options.windowMs).toISOString();
    const { error: insertError } = await admin.from('rate_limits').insert({
      key: options.key,
      route: options.route,
      expires_at: expiresAt,
    });

    if (insertError) {
      console.error('rateLimit insert error', insertError);
    } else {
      // Best-effort cleanup of expired entries (async, fire-and-forget)
      const cleanupThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      admin
        .from('rate_limits')
        .delete()
        .lt('expires_at', cleanupThreshold)
        .then(() => void 0)
        .catch(() => void 0);
    }

    return true;
  } catch (error) {
    console.error('rateLimit unexpected error', error);
    return true;
  }
}
