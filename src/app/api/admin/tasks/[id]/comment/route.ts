import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { assertCsrf } from '@/lib/csrf';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { enforceNotReadOnly } from '@/lib/admin/middleware-readonly';
import { createError, formatErrorResponse } from '@/lib/errors';

const BodySchema = z.object({
  message: z.string().trim().min(2).max(2000),
});

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { user } = await requireAdminPermission('tasks.write');
    await enforceNotReadOnly(req, user.id);
    await enforceAdminRateLimit(req, { route: 'admin:tasks:comment', max: 60, windowMs: 60_000 }, user.id);
    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch (csrfError) {
      throw createError('FORBIDDEN', 'Invalid CSRF token', 403, csrfError);
    }

    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      throw createError('VALIDATION_ERROR', 'Invalid payload', 400, parsed.error.flatten());
    }

    const admin = getAdminClient();
    const { data: task, error: taskError } = await admin.from('admin_tasks').select('id').eq('id', id).maybeSingle();
    if (taskError || !task) throw createError('NOT_FOUND', 'Task not found', 404, taskError?.message);

    const { error } = await admin.from('admin_task_events').insert({
      task_id: id,
      event_type: 'comment',
      message: parsed.data.message,
      created_by: user.id,
    });
    if (error) throw createError('DATABASE_ERROR', 'Failed to add comment', 500, error.message);

    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'admin_task_comment',
      table_name: 'admin_tasks',
      row_pk: id,
      new_values: { message_len: parsed.data.message.length },
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return formatErrorResponse(error);
  }
}

