import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { assertCsrf } from '@/lib/csrf';
import { updateContestStatus } from '@/lib/admin/contest-status';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { enforceNotReadOnly } from '@/lib/admin/middleware-readonly';
import { assertReason } from '@/lib/admin/reason';
import { contestValidators } from '@/lib/admin/validators';
import { notifyAdminAction } from '@/lib/admin/notifications';
import { adminCache } from '@/lib/admin/cache';
import { createError, formatErrorResponse } from '@/lib/errors';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireAdminPermission('contests.write');
    await enforceNotReadOnly(req, user.id);
    await enforceAdminRateLimit(req, { route: 'admin:contests:archive', max: 20, windowMs: 60_000 }, user.id);
    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch (csrfError) {
      throw createError('FORBIDDEN', 'Invalid CSRF token', 403, csrfError);
    }

    const { id: contestId } = await context.params;
    
    // Validation métier
    const validation = await contestValidators.canArchive(contestId);
    if (!validation.valid) {
      throw createError(
        'VALIDATION_ERROR',
        'Cannot archive contest',
        400,
        { errors: validation.errors }
      );
    }

    // Reason obligatoire
    const body = await req.json().catch(() => ({}));
    const { reason, reason_code } = assertReason(body);
    
    const { oldStatus, newStatus } = await updateContestStatus({
      contestId,
      newStatus: 'archived',
      actorId: user.id,
      action: 'contest_archive',
      reason,
      reasonCode: reason_code,
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      userAgent: req.headers.get('user-agent') ?? undefined,
      allowedFrom: ['ended', 'paused'],
    });

    // Notifier le brand owner
    const admin = getAdminClient();
    const { data: contest } = await admin
      .from('contests')
      .select('id, title, brand_id')
      .eq('id', contestId)
      .single();

    if (contest?.brand_id) {
      await notifyAdminAction({
        userId: contest.brand_id,
        type: 'contest_archived',
        data: {
          contest_id: contestId,
          contest_title: contest.title || undefined,
        },
      });
    }

    adminCache.invalidatePrefix('admin:kpis');
    adminCache.invalidatePrefix('admin:search');
    adminCache.invalidatePrefix('admin:lookup');
    adminCache.invalidatePrefix('admin:inbox');

    return NextResponse.json({ ok: true, old_status: oldStatus, new_status: newStatus });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
