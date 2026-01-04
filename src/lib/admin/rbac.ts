import { cache } from 'react';
import { createError } from '@/lib/errors';
import { getAdminClient } from '@/lib/admin/supabase';
import { requireAdminUser } from '@/lib/admin/guard';

type AdminRbacMode = 'disabled' | 'bootstrap' | 'enforced';

export type AdminAccess = {
  mode: AdminRbacMode;
  allowAll: boolean;
  isSuperAdmin: boolean;
  permissions: Set<string>;
};

type SupabaseErrorLike = { message?: string; code?: string } | null | undefined;

function isMissingTable(error: SupabaseErrorLike, tableName: string) {
  const code = String((error as any)?.code || '').toUpperCase();
  if (code === '42P01') return true;

  const msg = String((error as any)?.message || '').toLowerCase();
  if (!msg.includes(tableName.toLowerCase())) return false;

  if (msg.includes('schema cache')) {
    return msg.includes('table') && !msg.includes('column');
  }

  return msg.includes('does not exist') || msg.includes('could not find');
}

async function getRbacMode(): Promise<AdminRbacMode> {
  const admin = getAdminClient();
  const { data, error } = await admin.from('admin_staff').select('user_id').limit(1);

  if (error) {
    if (isMissingTable(error, 'admin_staff')) return 'disabled';
    throw createError('DATABASE_ERROR', 'Impossible de vérifier le RBAC admin', 500, error.message);
  }

  return (data ?? []).length === 0 ? 'bootstrap' : 'enforced';
}

async function loadPermissionsForUser(userId: string): Promise<AdminAccess> {
  const mode = await getRbacMode();
  if (mode === 'disabled') {
    return { mode, allowAll: true, isSuperAdmin: true, permissions: new Set() };
  }
  if (mode === 'bootstrap') {
    return { mode, allowAll: true, isSuperAdmin: true, permissions: new Set() };
  }

  const admin = getAdminClient();
  const { data: staff, error: staffError } = await admin
    .from('admin_staff')
    .select('user_id, is_active, is_super_admin')
    .eq('user_id', userId)
    .maybeSingle();

  if (staffError) {
    if (isMissingTable(staffError, 'admin_staff')) {
      return { mode: 'disabled', allowAll: true, isSuperAdmin: true, permissions: new Set() };
    }
    throw createError('DATABASE_ERROR', "Impossible de charger l'accès admin", 500, staffError.message);
  }

  if (!staff || !staff.is_active) {
    return { mode, allowAll: false, isSuperAdmin: false, permissions: new Set() };
  }

  if (staff.is_super_admin) {
    return { mode, allowAll: true, isSuperAdmin: true, permissions: new Set() };
  }

  const { data: staffRoles, error: staffRolesError } = await admin
    .from('admin_staff_roles')
    .select('role_id')
    .eq('user_id', userId);

  if (staffRolesError) {
    if (isMissingTable(staffRolesError, 'admin_staff_roles')) {
      return { mode: 'disabled', allowAll: true, isSuperAdmin: true, permissions: new Set() };
    }
    throw createError('DATABASE_ERROR', "Impossible de charger les rôles admin", 500, staffRolesError.message);
  }

  const roleIds = (staffRoles ?? []).map((r) => r.role_id).filter(Boolean) as string[];
  const permissions = new Set<string>();

  if (roleIds.length > 0) {
    const { data: rolePerms, error: rolePermsError } = await admin
      .from('admin_role_permissions')
      .select('permission_key')
      .in('role_id', roleIds);

    if (rolePermsError) {
      if (isMissingTable(rolePermsError, 'admin_role_permissions')) {
        return { mode: 'disabled', allowAll: true, isSuperAdmin: true, permissions: new Set() };
      }
      throw createError(
        'DATABASE_ERROR',
        "Impossible de charger les permissions admin",
        500,
        rolePermsError.message
      );
    }

    for (const p of rolePerms ?? []) {
      if (p.permission_key) permissions.add(p.permission_key);
    }
  }

  const { data: overrides, error: overridesError } = await admin
    .from('admin_staff_permission_overrides')
    .select('permission_key, allowed')
    .eq('user_id', userId);

  if (overridesError) {
    if (isMissingTable(overridesError, 'admin_staff_permission_overrides')) {
      return { mode: 'disabled', allowAll: true, isSuperAdmin: true, permissions: new Set() };
    }
    throw createError(
      'DATABASE_ERROR',
      "Impossible de charger les exceptions de permissions",
      500,
      overridesError.message
    );
  }

  for (const o of overrides ?? []) {
    if (!o.permission_key) continue;
    if (o.allowed) permissions.add(o.permission_key);
    else permissions.delete(o.permission_key);
  }

  return { mode, allowAll: false, isSuperAdmin: false, permissions };
}

export const getAdminAccess = cache(loadPermissionsForUser);

export function hasAdminPermission(access: AdminAccess, permission: string) {
  return access.allowAll || access.permissions.has(permission);
}

export async function requireAdminPermission(permission: string) {
  const user = await requireAdminUser();
  const access = await getAdminAccess(user.id);
  if (!hasAdminPermission(access, permission)) {
    throw createError('FORBIDDEN', 'Accès refusé', 403, { permission });
  }
  return { user, access };
}

export async function requireAdminAnyPermission(permissions: string[]) {
  const user = await requireAdminUser();
  const access = await getAdminAccess(user.id);

  if (access.allowAll) return { user, access };

  const allowed = permissions.some((permission) => hasAdminPermission(access, permission));
  if (!allowed) {
    throw createError('FORBIDDEN', 'Accès refusé', 403, { permissions });
  }

  return { user, access };
}
