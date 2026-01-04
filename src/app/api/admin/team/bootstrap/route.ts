import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { assertAdminBreakGlass } from '@/lib/admin/break-glass';
import { assertCsrf } from '@/lib/csrf';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { createError, formatErrorResponse } from '@/lib/errors';

type SupabaseErrorLike = { message?: string; code?: string } | null | undefined;

function isMissingTable(error: SupabaseErrorLike, tableName: string) {
  const code = String((error as any)?.code || '').toUpperCase();
  if (code === '42P01') return true;
  const msg = String((error as any)?.message || '').toLowerCase();
  if (!msg.includes(tableName.toLowerCase())) return false;
  if (msg.includes('schema cache')) return msg.includes('table') && !msg.includes('column');
  return msg.includes('does not exist') || msg.includes('could not find');
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAdminPermission('admin.team.write');
    await enforceAdminRateLimit(req, { route: 'admin:team:bootstrap', max: 10, windowMs: 60_000 });
    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch (csrfError) {
      throw createError('FORBIDDEN', 'Jeton CSRF invalide', 403, csrfError);
    }

    const breakGlass = assertAdminBreakGlass(req, 'admin.team.write');

    const admin = getAdminClient();
    const now = new Date().toISOString();

    const { error: upsertStaffError } = await admin.from('admin_staff').upsert({
      user_id: user.id,
      is_active: true,
      is_super_admin: true,
      created_by: user.id,
      updated_by: user.id,
      created_at: now,
      updated_at: now,
    });

    if (upsertStaffError) {
      if (isMissingTable(upsertStaffError, 'admin_staff')) {
        return NextResponse.json({ ok: false, missing_table: true }, { status: 200 });
      }
      throw createError('DATABASE_ERROR', "Impossible d'initialiser le RBAC", 500, upsertStaffError.message);
    }

    const { data: role, error: roleError } = await admin
      .from('admin_roles')
      .select('id')
      .eq('key', 'super_admin')
      .maybeSingle();

    if (!roleError && role?.id) {
      await admin.from('admin_staff_roles').delete().eq('user_id', user.id);
      await admin.from('admin_staff_roles').insert({ user_id: user.id, role_id: role.id, created_at: now });
    }

    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'admin_team_bootstrap',
      table_name: 'admin_staff',
      row_pk: user.id,
      new_values: { is_super_admin: true, ...(breakGlass.required ? { break_glass: breakGlass } : {}) },
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
