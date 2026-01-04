import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { assertAdminBreakGlass } from '@/lib/admin/break-glass';
import { assertCsrf } from '@/lib/csrf';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { createError, formatErrorResponse } from '@/lib/errors';

const UpdateSchema = z.object({
  description: z.string().nullable().optional(),
  is_enabled: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await context.params;
    const { user } = await requireAdminPermission('settings.write');
    await enforceAdminRateLimit(req, { route: 'admin:feature-flags:update', max: 10, windowMs: 60_000 });
    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch (csrfError) {
      throw createError('FORBIDDEN', 'Invalid CSRF token', 403, csrfError);
    }

    const breakGlass = assertAdminBreakGlass(req, 'settings.write');

    const body = await req.json();
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw createError('VALIDATION_ERROR', 'Invalid payload', 400, parsed.error.flatten());
    }

    const updates: Record<string, unknown> = { ...parsed.data };
    updates.updated_at = new Date().toISOString();

    const admin = getAdminClient();
    const { error } = await admin
      .from('feature_flags')
      .update(updates)
      .eq('key', key);

    if (error) {
      throw createError('DATABASE_ERROR', 'Failed to update flag', 500, error.message);
    }

    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'feature_flag_update',
      table_name: 'feature_flags',
      row_pk: key,
      new_values: { ...updates, ...(breakGlass.required ? { break_glass: breakGlass } : {}) },
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
  context: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await context.params;
    const { user } = await requireAdminPermission('settings.write');
    await enforceAdminRateLimit(req, { route: 'admin:feature-flags:delete', max: 10, windowMs: 60_000 });
    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch (csrfError) {
      throw createError('FORBIDDEN', 'Invalid CSRF token', 403, csrfError);
    }

    const breakGlass = assertAdminBreakGlass(req, 'settings.write');

    const admin = getAdminClient();
    const { error } = await admin.from('feature_flags').delete().eq('key', key);
    if (error) {
      throw createError('DATABASE_ERROR', 'Failed to delete flag', 500, error.message);
    }

    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'feature_flag_delete',
      table_name: 'feature_flags',
      row_pk: key,
      new_values: breakGlass.required ? { break_glass: breakGlass } : undefined,
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
