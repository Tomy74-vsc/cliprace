import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { assertCsrf } from '@/lib/csrf';
import { updateContestStatus } from '@/lib/admin/contest-status';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { createError, formatErrorResponse } from '@/lib/errors';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireAdminPermission('contests.write');
    await enforceAdminRateLimit(req, { route: 'admin:contests:publish', max: 20, windowMs: 60_000 });
    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch (csrfError) {
      throw createError('FORBIDDEN', 'Invalid CSRF token', 403, csrfError);
    }

    const { id: contestId } = await context.params;
    const { oldStatus, newStatus } = await updateContestStatus({
      contestId,
      newStatus: 'active',
      actorId: user.id,
      action: 'contest_publish',
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      userAgent: req.headers.get('user-agent') ?? undefined,
      allowedFrom: ['draft', 'paused'],
    });

    return NextResponse.json({ ok: true, old_status: oldStatus, new_status: newStatus });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
