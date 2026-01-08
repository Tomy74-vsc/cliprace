import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { assertCsrf } from '@/lib/csrf';
import { updateContestStatus } from '@/lib/admin/contest-status';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { enforceNotReadOnly } from '@/lib/admin/middleware-readonly';
import { assertReason } from '@/lib/admin/reason';
import { contestValidators } from '@/lib/admin/validators';
import { getAdminClient } from '@/lib/admin/supabase';
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
    await enforceAdminRateLimit(req, { route: 'admin:contests:publish', max: 20, windowMs: 60_000 }, user.id);
    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch (csrfError) {
      throw createError('FORBIDDEN', 'Invalid CSRF token', 403, csrfError);
    }

    const { id: contestId } = await context.params;
    
    // Reason obligatoire
    const body = await req.json().catch(() => ({}));
    const { reason, reason_code } = assertReason(body);
    
    // Validation métier
    const validation = await contestValidators.canPublish(contestId);
    if (!validation.valid) {
      throw createError(
        'VALIDATION_ERROR',
        'Cannot publish contest',
        400,
        { errors: validation.errors }
      );
    }
    const admin = getAdminClient();
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined;
    const userAgent = req.headers.get('user-agent') ?? undefined;

    // Prefer: transaction SQL (atomic)
    const { data: rpcData, error: rpcError } = await admin.rpc('admin_publish_contest', {
      p_contest_id: contestId,
      p_actor_id: user.id,
      p_reason: reason ?? null,
      p_reason_code: (reason_code as string | undefined) ?? null,
      p_ip: ip ?? null,
      p_user_agent: userAgent ?? null,
    });

    // Fallback: si la migration SQL n'est pas encore appliquée, on conserve l'ancien comportement
    // (non-atomique mais fonctionnel)
    if (rpcError) {
      const maybeMissingFn =
        typeof rpcError.message === 'string' &&
        (rpcError.message.includes('admin_publish_contest') || rpcError.message.includes('function'));

      if (!maybeMissingFn) {
        throw createError('DATABASE_ERROR', 'Contest publish failed', 500, rpcError.message);
      }

      const { oldStatus, newStatus } = await updateContestStatus({
        contestId,
        newStatus: 'active',
        actorId: user.id,
        action: 'contest_publish',
        reason,
        reasonCode: reason_code,
        ip,
        userAgent,
        allowedFrom: ['draft', 'paused'],
      });

      const { data: contest } = await admin
        .from('contests')
        .select('id, title, brand_id')
        .eq('id', contestId)
        .single();

      if (contest?.brand_id) {
        await notifyAdminAction({
          userId: contest.brand_id,
          type: 'contest_published',
          data: {
            contest_id: contestId,
            contest_title: contest.title || undefined,
          },
        });
      }

      // Invalidate hot admin caches (best effort)
      adminCache.invalidatePrefix('admin:kpis');
      adminCache.invalidatePrefix('admin:search');
      adminCache.invalidatePrefix('admin:lookup');
      adminCache.invalidatePrefix('admin:inbox');

      return NextResponse.json({ ok: true, old_status: oldStatus, new_status: newStatus, mode: 'fallback' });
    }

    const rpc = rpcData as { old_status?: string | null; new_status?: string | null } | null;
    const oldStatus = rpc?.old_status ?? null;
    const newStatus = rpc?.new_status ?? null;
    adminCache.invalidatePrefix('admin:kpis');
    adminCache.invalidatePrefix('admin:search');
    adminCache.invalidatePrefix('admin:lookup');
    adminCache.invalidatePrefix('admin:inbox');
    return NextResponse.json({ ok: true, old_status: oldStatus, new_status: newStatus, mode: 'rpc' });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
