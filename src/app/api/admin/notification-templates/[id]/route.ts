import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { assertCsrf } from '@/lib/csrf';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { enforceNotReadOnly } from '@/lib/admin/middleware-readonly';
import { createError, formatErrorResponse } from '@/lib/errors';

const BodySchema = z.object({
  event_type: z.string().min(2).max(100).optional(),
  channel: z.enum(['email', 'push', 'inapp', 'sms']).optional(),
  subject: z.string().optional().nullable(),
  body_html: z.string().optional().nullable(),
  body_text: z.string().optional().nullable(),
  variables: z.record(z.any()).optional(),
  is_active: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { user } = await requireAdminPermission('emails.write');
    await enforceNotReadOnly(req, user.id);
    await enforceAdminRateLimit(req, { route: 'admin:notification-templates:update', max: 20, windowMs: 60_000 }, user.id);
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
    const now = new Date().toISOString();
    const { error } = await admin
      .from('notification_templates')
      .update({ ...parsed.data, updated_at: now })
      .eq('id', id);

    if (error) {
      throw createError('DATABASE_ERROR', 'Failed to update template', 500, error.message);
    }

    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'notification_template_update',
      table_name: 'notification_templates',
      row_pk: id,
      new_values: parsed.data,
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return formatErrorResponse(error);
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { user } = await requireAdminPermission('emails.write');
    await enforceAdminRateLimit(req, { route: 'admin:notification-templates:delete', max: 20, windowMs: 60_000 }, user.id);
    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch (csrfError) {
      throw createError('FORBIDDEN', 'Invalid CSRF token', 403, csrfError);
    }

    const admin = getAdminClient();
    const { error } = await admin
      .from('notification_templates')
      .delete()
      .eq('id', id);

    if (error) {
      throw createError('DATABASE_ERROR', 'Failed to delete template', 500, error.message);
    }

    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'notification_template_delete',
      table_name: 'notification_templates',
      row_pk: id,
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
