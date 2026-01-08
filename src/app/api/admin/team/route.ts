import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { assertAdminBreakGlass } from '@/lib/admin/break-glass';
import { createError, formatErrorResponse } from '@/lib/errors';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { enforceNotReadOnly } from '@/lib/admin/middleware-readonly';
import { assertCsrf } from '@/lib/csrf';
import { teamValidators } from '@/lib/admin/validators';

type SupabaseErrorLike = { message?: string; code?: string } | null | undefined;

function isMissingTable(error: SupabaseErrorLike, tableName: string) {
  const code = String((error as UnsafeAny)?.code || '').toUpperCase();
  if (code === '42P01') return true;
  const msg = String((error as UnsafeAny)?.message || '').toLowerCase();
  if (!msg.includes(tableName.toLowerCase())) return false;
  if (msg.includes('schema cache')) return msg.includes('table') && !msg.includes('column');
  return msg.includes('does not exist') || msg.includes('could not find');
}

const CreateAdminSchema = z.object({
  email: z.string().email().max(120),
  display_name: z.string().min(1).max(80).optional(),
  send_invite: z.boolean().default(true),
  is_super_admin: z.boolean().default(false),
  role_keys: z.array(z.string().min(1).max(60)).default([]),
});

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireAdminPermission('admin.team.read');
    await enforceAdminRateLimit(req, { route: 'admin:team:list', max: 120, windowMs: 60_000 }, user.id);

    const admin = getAdminClient();
    const { data: staffRows, error: staffError } = await admin
      .from('admin_staff')
      .select('user_id, is_active, is_super_admin, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(200);

    if (staffError) {
      if (isMissingTable(staffError, 'admin_staff')) {
        return NextResponse.json({ ok: true, mode: 'disabled', missing_table: true });
      }
      throw createError('DATABASE_ERROR', "Impossible de charger l'équipe admin", 500, staffError.message);
    }

    const mode = (staffRows ?? []).length === 0 ? 'bootstrap' : 'enforced';
    const userIds = (staffRows ?? []).map((s) => s.user_id).filter(Boolean) as string[];

    const [{ data: roles, error: rolesError }, { data: perms, error: permsError }] = await Promise.all([
      admin.from('admin_roles').select('id, key, name, description').order('name', { ascending: true }),
      admin.from('admin_permissions').select('key, description').order('key', { ascending: true }),
    ]);

    if (rolesError) {
      if (isMissingTable(rolesError, 'admin_roles')) {
        return NextResponse.json({ ok: true, mode: 'disabled', missing_table: true });
      }
      throw createError('DATABASE_ERROR', 'Impossible de charger les rôles admin', 500, rolesError.message);
    }
    if (permsError) {
      if (isMissingTable(permsError, 'admin_permissions')) {
        return NextResponse.json({ ok: true, mode: 'disabled', missing_table: true });
      }
      throw createError('DATABASE_ERROR', 'Impossible de charger les permissions admin', 500, permsError.message);
    }

    const rolesById = new Map((roles ?? []).map((r) => [r.id, r]));

    const [{ data: profiles, error: profilesError }, { data: staffRoles, error: staffRolesError }] = await Promise.all([
      userIds.length
        ? admin.from('profiles').select('id, email, display_name').in('id', userIds)
        : Promise.resolve({ data: [], error: null }),
      userIds.length
        ? admin.from('admin_staff_roles').select('user_id, role_id').in('user_id', userIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (profilesError) {
      throw createError('DATABASE_ERROR', 'Impossible de charger les profils', 500, profilesError.message);
    }
    if (staffRolesError) {
      if (isMissingTable(staffRolesError, 'admin_staff_roles')) {
        return NextResponse.json({ ok: true, mode: 'disabled', missing_table: true });
      }
      throw createError('DATABASE_ERROR', 'Impossible de charger les assignations de rôles', 500, staffRolesError.message);
    }

    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
    const roleKeysByUser = new Map<string, string[]>();
    for (const row of staffRoles ?? []) {
      const role = rolesById.get(row.role_id);
      if (!role) continue;
      const arr = roleKeysByUser.get(row.user_id) ?? [];
      arr.push(role.key);
      roleKeysByUser.set(row.user_id, arr);
    }

    const staff = (staffRows ?? []).map((row) => {
      const profile = profileById.get(row.user_id);
      return {
        user_id: row.user_id,
        email: profile?.email ?? null,
        display_name: profile?.display_name ?? null,
        is_active: row.is_active,
        is_super_admin: row.is_super_admin,
        role_keys: roleKeysByUser.get(row.user_id) ?? [],
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
    });

    return NextResponse.json({
      ok: true,
      missing_table: false,
      mode,
      roles: roles ?? [],
      permissions: perms ?? [],
      staff,
    });
  } catch (error) {
    return formatErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAdminPermission('admin.team.write');
    await enforceNotReadOnly(req, user.id);
    await enforceAdminRateLimit(req, { route: 'admin:team:create', max: 30, windowMs: 60_000 }, user.id);
    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch (csrfError) {
      throw createError('FORBIDDEN', 'Jeton CSRF invalide', 403, csrfError);
    }

    const breakGlass = await assertAdminBreakGlass(req, 'admin.team.write', user.id);

    const parsed = CreateAdminSchema.safeParse(await req.json());
    if (!parsed.success) {
      throw createError('VALIDATION_ERROR', 'Payload invalide', 400, parsed.error.flatten());
    }

    const email = parsed.data.email.trim().toLowerCase();
    
    // Validation métier
    const validation = await teamValidators.canCreate(email, user.id);
    if (!validation.valid) {
      throw createError(
        'VALIDATION_ERROR',
        'Cannot create admin team member',
        400,
        { errors: validation.errors }
      );
    }

    const admin = getAdminClient();
    const displayName = parsed.data.display_name?.trim() || null;

    const { data: existingProfile, error: existingProfileError } = await admin
      .from('profiles')
      .select('id, role, email, display_name')
      .eq('email', email)
      .maybeSingle();

    if (existingProfileError) {
      throw createError('DATABASE_ERROR', 'Impossible de vérifier le profil', 500, existingProfileError.message);
    }

    let userId: string;
    let created = false;
    if (existingProfile?.id) {
      userId = existingProfile.id;
      if (existingProfile.role !== 'admin') {
        const { error: updateRoleError } = await admin
          .from('profiles')
          .update({ role: 'admin', is_active: true, updated_at: new Date().toISOString() })
          .eq('id', userId);
        if (updateRoleError) {
          throw createError('DATABASE_ERROR', "Impossible de promouvoir l'utilisateur en admin", 500, updateRoleError.message);
        }
      }
      const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(userId);
      if (!authErr && authUser.user) {
        const mergedMetadata = { ...(authUser.user.user_metadata ?? {}), role: 'admin' };
        await admin.auth.admin.updateUserById(userId, { user_metadata: mergedMetadata });
      }
    } else {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || 'http://localhost:3000';
      if (parsed.data.send_invite) {
        const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
          data: { role: 'admin' },
          redirectTo: `${siteUrl}/auth/verify?email=${encodeURIComponent(email)}`,
        });
        if (inviteError || !inviteData.user) {
          throw createError('DATABASE_ERROR', "Impossible d'inviter l'admin", 500, inviteError?.message);
        }
        userId = inviteData.user.id;
      } else {
        const { data: createData, error: createErr } = await admin.auth.admin.createUser({
          email,
          email_confirm: false,
          user_metadata: { role: 'admin' },
        });
        if (createErr || !createData.user) {
          throw createError('DATABASE_ERROR', "Impossible de créer l'admin", 500, createErr?.message);
        }
        userId = createData.user.id;
      }

      const now = new Date().toISOString();
      const { error: insertProfileError } = await admin.from('profiles').insert({
        id: userId,
        role: 'admin',
        email,
        display_name: displayName ?? email,
        is_active: true,
        onboarding_complete: true,
        created_at: now,
        updated_at: now,
      });
      if (insertProfileError) {
        try {
          await admin.auth.admin.deleteUser(userId);
        } catch {}
        throw createError('DATABASE_ERROR', 'Impossible de créer le profil admin', 500, insertProfileError.message);
      }
      created = true;
    }

    const now = new Date().toISOString();
    const { error: upsertStaffError } = await admin.from('admin_staff').upsert({
      user_id: userId,
      is_active: true,
      is_super_admin: parsed.data.is_super_admin,
      created_by: user.id,
      updated_by: user.id,
      created_at: now,
      updated_at: now,
    });

    if (upsertStaffError) {
      if (isMissingTable(upsertStaffError, 'admin_staff')) {
        return NextResponse.json({ ok: false, missing_table: true }, { status: 200 });
      }
      throw createError('DATABASE_ERROR', "Impossible d'ajouter l'admin au staff", 500, upsertStaffError.message);
    }

    const roleKeys = parsed.data.role_keys.length
      ? parsed.data.role_keys
      : parsed.data.is_super_admin
        ? ['super_admin']
        : ['ops'];

    const { data: roles, error: rolesError } = await admin
      .from('admin_roles')
      .select('id, key')
      .in('key', roleKeys);

    if (rolesError) {
      if (isMissingTable(rolesError, 'admin_roles')) {
        return NextResponse.json({ ok: true, missing_table: true }, { status: 200 });
      }
      throw createError('DATABASE_ERROR', 'Impossible de charger les rôles', 500, rolesError.message);
    }

    const roleIds = (roles ?? []).map((r) => r.id).filter(Boolean) as string[];

    await admin.from('admin_staff_roles').delete().eq('user_id', userId);
    if (roleIds.length > 0) {
      const { error: insertRolesError } = await admin.from('admin_staff_roles').insert(
        roleIds.map((roleId) => ({
          user_id: userId,
          role_id: roleId,
          created_at: now,
        }))
      );
      if (insertRolesError) {
        throw createError('DATABASE_ERROR', "Impossible d'assigner les rôles", 500, insertRolesError.message);
      }
    }

    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: created ? 'admin_team_invite' : 'admin_team_update',
      table_name: 'admin_staff',
      row_pk: userId,
      new_values: {
        email,
        is_super_admin: parsed.data.is_super_admin,
        role_keys: roleKeys,
        ...(breakGlass.required ? { break_glass: breakGlass } : {}),
      },
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({ ok: true, user_id: userId, role_keys: roleKeys });
  } catch (error) {
    return formatErrorResponse(error);
  }
}

