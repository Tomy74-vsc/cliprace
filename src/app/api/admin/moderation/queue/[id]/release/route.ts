import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { assertCsrf } from '@/lib/csrf';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { enforceNotReadOnly } from '@/lib/admin/middleware-readonly';
import { moderationValidators } from '@/lib/admin/validators';
import { createError, formatErrorResponse } from '@/lib/errors';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { user } = await requireAdminPermission('moderation.write');
    await enforceNotReadOnly(req, user.id);
    await enforceAdminRateLimit(req, { route: 'admin:moderation:queue:release', max: 30, windowMs: 60_000 }, user.id);
    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch (csrfError) {
      throw createError('FORBIDDEN', 'Invalid CSRF token', 403, csrfError);
    }

    // Validation métier
    const validation = await moderationValidators.canRelease(id, user.id);
    if (!validation.valid) {
      throw createError(
        'VALIDATION_ERROR',
        'Cannot release queue item',
        400,
        { errors: validation.errors }
      );
    }

    const admin = getAdminClient();
    const { data: queueItem, error } = await admin
      .from('moderation_queue')
      .select('id, status, reviewed_by')
      .eq('id', id)
      .single();

    if (error || !queueItem) {
      throw createError('NOT_FOUND', 'Queue item not found', 404, error?.message);
    }

    const now = new Date().toISOString();
    const { error: updateError } = await admin
      .from('moderation_queue')
      .update({
        status: 'pending',
        reviewed_by: null,
        reviewed_at: null,
        updated_at: now,
      })
      .eq('id', id);

    if (updateError) {
      throw createError('DATABASE_ERROR', 'Failed to release queue item', 500, updateError.message);
    }

    return NextResponse.json({ ok: true, status: 'pending' });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
