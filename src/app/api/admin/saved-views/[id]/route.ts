import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { assertCsrf } from '@/lib/csrf';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { enforceNotReadOnly } from '@/lib/admin/middleware-readonly';
import { createError, formatErrorResponse } from '@/lib/errors';

function isMissingTable(error: { message?: string; code?: string } | null | undefined) {
  const code = String(error?.code || '').toUpperCase();
  if (code === '42P01') return true;

  const msg = (error?.message || '').toLowerCase();
  if (!msg.includes('admin_saved_views')) return false;

  if (msg.includes('schema cache')) {
    return msg.includes('table') && !msg.includes('column');
  }

  return msg.includes('does not exist') || msg.includes('could not find');
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireAdminPermission('dashboard.read');
    await enforceNotReadOnly(req, user.id);
    await enforceAdminRateLimit(req, { route: 'admin:saved-views:delete', max: 60, windowMs: 60_000 }, user.id);
    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch (csrfError) {
      throw createError('FORBIDDEN', 'Jeton CSRF invalide', 403, csrfError);
    }

    const { id } = await context.params;
    const admin = getAdminClient();
    const { error } = await admin.from('admin_saved_views').delete().eq('id', id);
    if (error) {
      if (isMissingTable(error)) {
        return NextResponse.json({ ok: false, missing_table: true }, { status: 200 });
      }
      throw createError('DATABASE_ERROR', 'Impossible de supprimer la vue', 500, error.message);
    }

    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'admin_saved_view_delete',
      table_name: 'admin_saved_views',
      row_pk: id,
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({ ok: true, missing_table: false });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
