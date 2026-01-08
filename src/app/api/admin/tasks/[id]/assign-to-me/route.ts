import { NextRequest, NextResponse } from 'next/server';

import { requireAdminPermission, hasAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { assertCsrf } from '@/lib/csrf';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { enforceNotReadOnly } from '@/lib/admin/middleware-readonly';
import { createError, formatErrorResponse } from '@/lib/errors';
import { getTaskPermission } from '@/lib/admin/admin-tasks';

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { user, access } = await requireAdminPermission('tasks.write');
    await enforceNotReadOnly(req, user.id);
    await enforceAdminRateLimit(req, { route: 'admin:tasks:assign_to_me', max: 60, windowMs: 60_000 }, user.id);
    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch (csrfError) {
      throw createError('FORBIDDEN', 'Invalid CSRF token', 403, csrfError);
    }

    const admin = getAdminClient();
    const { data: task, error } = await admin
      .from('admin_tasks')
      .select('id, source_table, source_id, task_type, status, assigned_to')
      .eq('id', id)
      .maybeSingle();

    if (error || !task) throw createError('NOT_FOUND', 'Task not found', 404, error?.message);

    const perm = getTaskPermission(task.task_type);
    if (perm?.write && !hasAdminPermission(access, perm.write)) {
      throw createError('FORBIDDEN', "Vous n'avez pas les droits pour prendre en charge cette tâche.", 403, {
        required: perm.write,
      });
    }

    const nowIso = new Date().toISOString();
    const nextStatus = task.status === 'open' ? 'in_progress' : task.status;

    const { error: updateErr } = await admin
      .from('admin_tasks')
      .update({ assigned_to: user.id, status: nextStatus, updated_at: nowIso })
      .eq('id', task.id);
    if (updateErr) throw createError('DATABASE_ERROR', 'Failed to assign task', 500, updateErr.message);

    // Best-effort propagation to source tables (keeps existing pages consistent)
    if (task.source_table === 'support_tickets') {
      await admin
        .from('support_tickets')
        .update({ assigned_to: user.id, updated_at: nowIso })
        .eq('id', task.source_id);
    } else if (task.source_table === 'sales_leads') {
      await admin
        .from('sales_leads')
        .update({ assigned_to: user.id, updated_at: nowIso })
        .eq('id', task.source_id);
    } else if (task.source_table === 'moderation_queue') {
      const { data: row } = await admin
        .from('moderation_queue')
        .select('id, status, reviewed_by')
        .eq('id', task.source_id)
        .maybeSingle();
      if (row && (row as UnsafeAny).status === 'pending') {
        await admin
          .from('moderation_queue')
          .update({ status: 'processing', reviewed_by: user.id, reviewed_at: nowIso, updated_at: nowIso })
          .eq('id', task.source_id);
      }
    }

    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'admin_task_assign_to_me',
      table_name: 'admin_tasks',
      row_pk: task.id,
      new_values: { assigned_to: user.id, status: nextStatus },
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return formatErrorResponse(error);
  }
}


