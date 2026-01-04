import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { assertCsrf } from '@/lib/csrf';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { createError, formatErrorResponse } from '@/lib/errors';

const StatusEnum = z.enum(['open', 'in_progress', 'blocked', 'done', 'canceled']);
const PriorityEnum = z.enum(['low', 'normal', 'high', 'critical']);

const PatchSchema = z.object({
  status: StatusEnum.optional(),
  priority: PriorityEnum.optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  due_at: z.string().datetime().nullable().optional(),
});

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { user } = await requireAdminPermission('tasks.write');
    await enforceAdminRateLimit(req, { route: 'admin:tasks:update', max: 60, windowMs: 60_000 });
    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch (csrfError) {
      throw createError('FORBIDDEN', 'Invalid CSRF token', 403, csrfError);
    }

    const body = await req.json();
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      throw createError('VALIDATION_ERROR', 'Invalid payload', 400, parsed.error.flatten());
    }

    const admin = getAdminClient();
    const { data: task, error: taskError } = await admin
      .from('admin_tasks')
      .select('id, status, assigned_to, priority, due_at')
      .eq('id', id)
      .maybeSingle();

    if (taskError || !task) throw createError('NOT_FOUND', 'Task not found', 404, taskError?.message);

    const updates: Record<string, unknown> = { ...parsed.data, updated_at: new Date().toISOString() };
    if (Object.keys(parsed.data).length === 0) return NextResponse.json({ ok: true });

    const { error } = await admin.from('admin_tasks').update(updates).eq('id', id);
    if (error) throw createError('DATABASE_ERROR', 'Failed to update task', 500, error.message);

    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'admin_task_update',
      table_name: 'admin_tasks',
      row_pk: id,
      old_values: { status: task.status, assigned_to: task.assigned_to, priority: task.priority, due_at: task.due_at },
      new_values: parsed.data,
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return formatErrorResponse(error);
  }
}

