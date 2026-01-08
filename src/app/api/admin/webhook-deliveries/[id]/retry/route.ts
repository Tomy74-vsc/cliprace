import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { assertCsrf } from '@/lib/csrf';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { enforceNotReadOnly } from '@/lib/admin/middleware-readonly';
import { createError, formatErrorResponse } from '@/lib/errors';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { user } = await requireAdminPermission('integrations.write');
    await enforceNotReadOnly(req, user.id);
    await enforceAdminRateLimit(req, { route: 'admin:webhooks:deliveries:retry', max: 60, windowMs: 60_000 }, user.id);

    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch (csrfError) {
      throw createError('FORBIDDEN', 'Invalid CSRF token', 403, csrfError);
    }

    const deliveryId = Number(id);
    if (!Number.isFinite(deliveryId)) {
      throw createError('VALIDATION_ERROR', 'Invalid id', 400);
    }

    const admin = getAdminClient();
    const { data: current, error: loadError } = await admin
      .from('webhook_deliveries')
      .select('id, status, retry_count')
      .eq('id', deliveryId)
      .single();

    if (loadError) {
      throw createError('DATABASE_ERROR', 'Failed to load webhook delivery', 500, loadError.message);
    }

    const nextRetryCount = (current?.retry_count ?? 0) + 1;
    const { data, error } = await admin
      .from('webhook_deliveries')
      .update({
        status: 'pending',
        retry_count: nextRetryCount,
        last_error: null,
      })
      .eq('id', deliveryId)
      .select('id, status, retry_count, updated_at')
      .single();

    if (error) {
      throw createError('DATABASE_ERROR', 'Failed to retry webhook delivery', 500, error.message);
    }

    return NextResponse.json({ item: data });
  } catch (error) {
    return formatErrorResponse(error);
  }
}

