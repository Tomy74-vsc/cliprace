import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { assertCsrf } from '@/lib/csrf';
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
    const { id } = await context.params;
    const { user } = await requireAdminPermission('contests.write');
    await enforceNotReadOnly(req, user.id);
    await enforceAdminRateLimit(req, { route: 'admin:contests:end', max: 10, windowMs: 60_000 }, user.id);
    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch (csrfError) {
      throw createError('FORBIDDEN', 'Invalid CSRF token', 403, csrfError);
    }

    // Validation métier
    const validation = await contestValidators.canEnd(id);
    if (!validation.valid) {
      throw createError(
        'VALIDATION_ERROR',
        'Cannot end contest',
        400,
        { errors: validation.errors }
      );
    }

    // Reason obligatoire (trace admin)
    const body = await req.json().catch(() => ({}));
    const { reason, reason_code } = assertReason(body);

    const admin = getAdminClient();
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined;
    const userAgent = req.headers.get('user-agent') ?? undefined;

    // Prefer: transaction SQL (atomic, no duplicate status_history)
    const { data: rpcData, error: rpcError } = await admin.rpc('admin_end_contest', {
      p_contest_id: id,
      p_actor_id: user.id,
      p_reason: reason ?? null,
      p_reason_code: (reason_code as string | undefined) ?? null,
      p_ip: ip ?? null,
      p_user_agent: userAgent ?? null,
    });

    // Fallback: si la migration SQL n'est pas encore appliquée, on conserve l'ancien comportement
    // (finalize_contest + logs; peut dupliquer status_history mais garde la raison côté admin)
    if (rpcError) {
      const maybeMissingFn =
        typeof rpcError.message === 'string' &&
        (rpcError.message.includes('admin_end_contest') || rpcError.message.includes('function'));

      if (!maybeMissingFn) {
        throw createError('DATABASE_ERROR', 'Contest end failed', 500, rpcError.message);
      }

      const { data: contest, error: contestError } = await admin
        .from('contests')
        .select('id, status, title, brand_id')
        .eq('id', id)
        .single();

      if (contestError || !contest) {
        throw createError('NOT_FOUND', 'Contest not found', 404, contestError?.message);
      }

      const { error: finalizeError } = await admin.rpc('finalize_contest', {
        p_contest_id: id,
      });
      if (finalizeError) {
        throw createError('DATABASE_ERROR', 'Contest finalize failed', 500, finalizeError.message);
      }

      await admin.from('status_history').insert({
        table_name: 'contests',
        row_id: id,
        old_status: contest.status,
        new_status: 'ended',
        changed_by: user.id,
        reason: reason || null,
        reason_code: (reason_code as string | undefined) ?? null,
        metadata: {
          source: 'admin_api_fallback',
        },
      });

      await admin.from('audit_logs').insert({
        actor_id: user.id,
        action: 'contest_end',
        table_name: 'contests',
        row_pk: id,
        old_values: { status: contest.status },
        new_values: { status: 'ended', reason: reason || null, reason_code: (reason_code as string | undefined) ?? null },
        ip: req.headers.get('x-forwarded-for') ?? undefined,
        user_agent: req.headers.get('user-agent') ?? undefined,
      });

      if (contest.brand_id) {
        await notifyAdminAction({
          userId: contest.brand_id,
          type: 'contest_ended',
          data: {
            contest_id: id,
            contest_title: contest.title || undefined,
          },
        });
      }

      adminCache.invalidatePrefix('admin:kpis');
      adminCache.invalidatePrefix('admin:search');
      adminCache.invalidatePrefix('admin:lookup');
      adminCache.invalidatePrefix('admin:inbox');

      return NextResponse.json({ ok: true, old_status: contest.status, new_status: 'ended', mode: 'fallback' });
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
