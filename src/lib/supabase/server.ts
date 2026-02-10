// Source: Supabase admin client (service role) — server-only
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { createError } from '@/lib/errors';

function getJwtRole(jwt: string): string | null {
  try {
    const parts = jwt.split('.');
    if (parts.length < 2) return null;
    const base64url = parts[1];
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json = Buffer.from(padded, 'base64').toString('utf8');
    const payload = JSON.parse(json) as { role?: unknown };
    return typeof payload.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

export function getSupabaseAdmin() {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw createError('CONFIG_ERROR', 'NEXT_PUBLIC_SUPABASE_URL manquante (Supabase)', 500);
  }
  if (!serviceKey) {
    throw createError('CONFIG_ERROR', 'SUPABASE_SERVICE_ROLE_KEY manquante (Supabase)', 500);
  }
  const role = getJwtRole(serviceKey);
  if (role && role !== 'service_role') {
    throw createError(
      'CONFIG_ERROR',
      `SUPABASE_SERVICE_ROLE_KEY invalide: role JWT="${role}" (attendu: "service_role"). Copie la clé "service_role" depuis Supabase → Project Settings → API.`,
      500
    );
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

