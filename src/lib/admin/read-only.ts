import { getAdminClient } from './supabase';
import { createError } from '@/lib/errors';

/**
 * Vérifie si le mode read-only est activé
 */
export async function isAdminReadOnly(): Promise<boolean> {
  const admin = getAdminClient();
  const { data: setting } = await admin
    .from('platform_settings')
    .select('value')
    .eq('key', 'admin_read_only')
    .maybeSingle();

  if (!setting) {
    return false; // Par défaut, pas de read-only
  }

  const value = setting.value;
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    return value === 'true';
  }
  return false;
}

/**
 * Vérifie si l'utilisateur est super-admin (bypass read-only)
 */
export async function isSuperAdmin(userId: string): Promise<boolean> {
  const admin = getAdminClient();
  const { data: staff } = await admin
    .from('admin_staff')
    .select('is_super_admin')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  return staff?.is_super_admin === true;
}

/**
 * Assert que le mode read-only n'est pas activé (ou que l'utilisateur est super-admin)
 */
export async function assertNotReadOnly(userId: string): Promise<void> {
  const readOnly = await isAdminReadOnly();
  if (!readOnly) {
    return; // Pas de read-only, OK
  }

  // Vérifier si super-admin (peut bypass)
  const superAdmin = await isSuperAdmin(userId);
  if (superAdmin) {
    return; // Super-admin peut bypass
  }

  throw createError(
    'FORBIDDEN',
    'Mode read-only activé. Toutes les mutations sont bloquées en maintenance.',
    503,
    {
      read_only: true,
      message: 'Le système est en mode maintenance. Seuls les super-admins peuvent effectuer des modifications.',
    }
  );
}

