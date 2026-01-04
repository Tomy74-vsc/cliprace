import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { assertCsrf } from '@/lib/csrf';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { createError, formatErrorResponse } from '@/lib/errors';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { user } = await requireAdminPermission('moderation.write');
    await enforceAdminRateLimit(req, { route: 'admin:moderation:queue:claim', max: 30, windowMs: 60_000 });
    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch (csrfError) {
      throw createError('FORBIDDEN', 'Invalid CSRF token', 403, csrfError);
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

    if (queueItem.status !== 'pending') {
      if (queueItem.status === 'processing' && queueItem.reviewed_by === user.id) {
        return NextResponse.json({ ok: true, status: 'processing' });
      }
      throw createError('CONFLICT', 'Queue item already claimed', 409);
    }

    const now = new Date().toISOString();
    const { error: updateError } = await admin
      .from('moderation_queue')
      .update({
        status: 'processing',
        reviewed_by: user.id,
        reviewed_at: now,
        updated_at: now,
      })
      .eq('id', id);

    if (updateError) {
      throw createError('DATABASE_ERROR', 'Failed to claim queue item', 500, updateError.message);
    }

    return NextResponse.json({ ok: true, status: 'processing' });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
