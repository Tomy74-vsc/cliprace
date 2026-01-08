import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { assertAdminBreakGlass } from '@/lib/admin/break-glass';
import { assertCsrf } from '@/lib/csrf';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { enforceNotReadOnly } from '@/lib/admin/middleware-readonly';
import { teamValidators } from '@/lib/admin/validators';
import { createError, formatErrorResponse } from '@/lib/errors';

const PatchSchema = z.object({
  is_active: z.boolean().optional(),
  is_super_admin: z.boolean().optional(),
  role_keys: z.array(z.string().min(1).max(60)).optional(),
});

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireAdminPermission('admin.team.write');
    await enforceNotReadOnly(req, user.id);
    await enforceAdminRateLimit(req, { route: 'admin:team:update', max: 60, windowMs: 60_000 }, user.id);
    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch (csrfError) {
      throw createError('FORBIDDEN', 'Jeton CSRF invalide', 403, csrfError);
    }

    const breakGlass = await assertAdminBreakGlass(req, 'admin.team.write', user.id);

    const { id } = await context.params;
    const parsed = PatchSchema.safeParse(await req.json());
    if (!parsed.success) {
      throw createError('VALIDATION_ERROR', 'Payload invalide', 400, parsed.error.flatten());
    }

    // Validation métier
    const validation = await teamValidators.canUpdate(id, user.id, { is_active: parsed.data.is_active });
    if (!validation.valid) {
      throw createError(
        'VALIDATION_ERROR',
        'Cannot update admin team member',
        400,
        { errors: validation.errors }
      );
    }

    const admin = getAdminClient();
    const update: Record<string, unknown> = { updated_by: user.id, updated_at: new Date().toISOString() };
    if (typeof parsed.data.is_active === 'boolean') update.is_active = parsed.data.is_active;
    if (typeof parsed.data.is_super_admin === 'boolean') update.is_super_admin = parsed.data.is_super_admin;

    const { error: staffError } = await admin.from('admin_staff').update(update).eq('user_id', id);
    if (staffError) {
      throw createError('DATABASE_ERROR', "Impossible de mettre à jour l'admin", 500, staffError.message);
    }

    if (parsed.data.role_keys) {
      const { data: roles, error: rolesError } = await admin
        .from('admin_roles')
        .select('id, key')
        .in('key', parsed.data.role_keys);

      if (rolesError) {
        throw createError('DATABASE_ERROR', 'Impossible de charger les rôles', 500, rolesError.message);
      }

      const roleIds = (roles ?? []).map((r) => r.id).filter(Boolean) as string[];
      await admin.from('admin_staff_roles').delete().eq('user_id', id);
      if (roleIds.length > 0) {
        const now = new Date().toISOString();
        const { error: insertRolesError } = await admin.from('admin_staff_roles').insert(
          roleIds.map((roleId) => ({
            user_id: id,
            role_id: roleId,
            created_at: now,
          }))
        );
        if (insertRolesError) {
          throw createError('DATABASE_ERROR', "Impossible d'assigner les rôles", 500, insertRolesError.message);
        }
      }
    }

    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'admin_team_patch',
      table_name: 'admin_staff',
      row_pk: id,
      new_values: { ...parsed.data, ...(breakGlass.required ? { break_glass: breakGlass } : {}) },
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
