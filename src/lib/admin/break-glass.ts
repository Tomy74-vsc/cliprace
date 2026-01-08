import { NextRequest } from 'next/server';
import { getAdminClient } from './supabase';
import { createError } from '@/lib/errors';

export type AdminBreakGlass = {
  required: boolean;
  confirmed: boolean;
  active: boolean;
  expires_at?: string;
  reason?: string;
};

const REQUIRED_HEADER = 'x-admin-break-glass-confirm';
const REASON_HEADER = 'x-admin-break-glass-reason';

export function isAdminBreakGlassRequired(permission: string) {
  return ['finance.write', 'settings.write', 'users.write', 'admin.team.write'].includes(permission);
}

/**
 * Vérifie si l'admin a un break-glass actif (TTL)
 */
export async function checkAdminBreakGlass(userId: string): Promise<{ active: boolean; expires_at?: string; reason?: string }> {
  const admin = getAdminClient();
  const { data: staff } = await admin
    .from('admin_staff')
    .select('break_glass_until, break_glass_reason')
    .eq('user_id', userId)
    .maybeSingle();

  if (!staff || !staff.break_glass_until) {
    return { active: false };
  }

  const expiresAt = new Date(staff.break_glass_until);
  const now = new Date();
  const active = expiresAt > now;

  return {
    active,
    expires_at: staff.break_glass_until,
    reason: staff.break_glass_reason || undefined,
  };
}

/**
 * Active break-glass pour un admin (TTL)
 */
export async function enableAdminBreakGlass(userId: string, ttlMinutes: number, reason: string): Promise<{ expires_at: string }> {
  const admin = getAdminClient();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();

  const { error } = await admin
    .from('admin_staff')
    .update({
      break_glass_until: expiresAt,
      break_glass_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) {
    throw createError('DATABASE_ERROR', 'Failed to enable break-glass', 500, error.message);
  }

  return { expires_at: expiresAt };
}

/**
 * Vérifie et valide break-glass pour une requête
 */
export async function assertAdminBreakGlass(req: NextRequest, permission: string, userId: string): Promise<AdminBreakGlass> {
  if (!isAdminBreakGlassRequired(permission)) {
    return { required: false, confirmed: false, active: false };
  }

  // Vérifier break-glass actif dans DB
  const breakGlassStatus = await checkAdminBreakGlass(userId);
  
  if (breakGlassStatus.active) {
    // Break-glass actif, autoriser
    return {
      required: true,
      confirmed: true,
      active: true,
      expires_at: breakGlassStatus.expires_at,
      reason: breakGlassStatus.reason,
    };
  }

  // Break-glass non actif, vérifier headers pour activation immédiate
  const confirm = (req.headers.get(REQUIRED_HEADER) ?? '').trim();
  const reason = (req.headers.get(REASON_HEADER) ?? '').trim();

  if (confirm !== 'BREAK-GLASS' || reason.length < 8) {
    throw createError('FORBIDDEN', 'Break-glass requis et non actif', 403, {
      permission,
      required_header: REQUIRED_HEADER,
      reason_header: REASON_HEADER,
      message: 'Cette action nécessite un break-glass actif. Activez-le d\'abord via l\'interface admin.',
    });
  }

  // Activer break-glass pour 30 min par défaut
  const { expires_at } = await enableAdminBreakGlass(userId, 30, reason);

  return {
    required: true,
    confirmed: true,
    active: true,
    expires_at,
    reason,
  };
}

