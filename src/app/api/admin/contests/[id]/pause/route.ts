import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { assertCsrf } from '@/lib/csrf';
import { updateContestStatus } from '@/lib/admin/contest-status';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { enforceNotReadOnly } from '@/lib/admin/middleware-readonly';
import { contestValidators } from '@/lib/admin/validators';
import { notifyAdminAction } from '@/lib/admin/notifications';
import { createError, formatErrorResponse } from '@/lib/errors';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireAdminPermission('contests.write');
    await enforceNotReadOnly(req, user.id);
    await enforceAdminRateLimit(req, { route: 'admin:contests:pause', max: 20, windowMs: 60_000 }, user.id);
    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch (csrfError) {
      throw createError('FORBIDDEN', 'Invalid CSRF token', 403, csrfError);
    }

    const { id: contestId } = await context.params;
    
    // Validation métier
    const validation = await contestValidators.canPause(contestId);
    if (!validation.valid) {
      throw createError(
        'VALIDATION_ERROR',
        'Cannot pause contest',
        400,
        { errors: validation.errors }
      );
    }
    
    const { oldStatus, newStatus } = await updateContestStatus({
      contestId,
      newStatus: 'paused',
      actorId: user.id,
      action: 'contest_pause',
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      userAgent: req.headers.get('user-agent') ?? undefined,
      allowedFrom: ['active'],
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
        type: 'contest_paused',
        data: {
          contest_id: contestId,
          contest_title: contest.title || undefined,
        },
      });
    }

    return NextResponse.json({ ok: true, old_status: oldStatus, new_status: newStatus });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
