import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { enforceNotReadOnly } from '@/lib/admin/middleware-readonly';
import { assertCsrf } from '@/lib/csrf';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { createError, formatErrorResponse } from '@/lib/errors';

const UpdateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(500).nullable().optional(),
  rule_type: z.enum(['content', 'spam', 'duplicate', 'domain', 'flood']).optional(),
  config: z.record(z.unknown()).optional(),
  status: z.enum(['draft', 'published']).optional(),
  is_active: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { user } = await requireAdminPermission('moderation.write');
    await enforceNotReadOnly(req, user.id);
    await enforceAdminRateLimit(req, { route: 'admin:moderation:rules:update', max: 30, windowMs: 60_000 }, user.id);
    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch (csrfError) {
      throw createError('FORBIDDEN', 'Invalid CSRF token', 403, csrfError);
    }

    const body = await req.json();
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw createError('VALIDATION_ERROR', 'Invalid payload', 400, parsed.error.flatten());
    }

    const next = { ...parsed.data } as Record<string, unknown>;
    if (parsed.data.status === 'draft') {
      next.is_active = false;
    }

    const admin = getAdminClient();

    let updateRes = await admin
      .from('moderation_rules')
      .update(next)
      .eq('id', id)
      .select('*')
      .single();

    if (updateRes.error && updateRes.error.message?.includes('column \"status\"')) {
      const { status: _status, ...fallback } = next as UnsafeAny;
      updateRes = await admin
        .from('moderation_rules')
        .update(fallback)
        .eq('id', id)
        .select('*')
        .single();
    }

    const { data, error } = updateRes;

    if (error) {
      throw createError('DATABASE_ERROR', 'Failed to update rule', 500, error.message);
    }

    return NextResponse.json({ item: data });
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
    const { user } = await requireAdminPermission('moderation.write');
    await enforceNotReadOnly(req, user.id);
    await enforceAdminRateLimit(req, { route: 'admin:moderation:rules:delete', max: 30, windowMs: 60_000 }, user.id);
    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch (csrfError) {
      throw createError('FORBIDDEN', 'Invalid CSRF token', 403, csrfError);
    }

    const admin = getAdminClient();
    const { error } = await admin.from('moderation_rules').delete().eq('id', id);
    if (error) {
      throw createError('DATABASE_ERROR', 'Failed to delete rule', 500, error.message);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return formatErrorResponse(error);
  }
}

