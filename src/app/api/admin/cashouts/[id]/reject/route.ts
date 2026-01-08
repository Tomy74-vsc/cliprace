import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { assertAdminBreakGlass } from '@/lib/admin/break-glass';
import { assertCsrf } from '@/lib/csrf';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { enforceNotReadOnly } from '@/lib/admin/middleware-readonly';
import { assertReason } from '@/lib/admin/reason';
import { auditAdminAction } from '@/lib/admin/audit-enhanced';
import { cashoutValidators } from '@/lib/admin/validators';
import { notifyAdminAction } from '@/lib/admin/notifications';
import { createError, formatErrorResponse } from '@/lib/errors';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { user } = await requireAdminPermission('finance.write');
    await enforceNotReadOnly(req, user.id);
    await enforceAdminRateLimit(req, { route: 'admin:cashouts:reject', max: 10, windowMs: 60_000 }, user.id);
    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch (csrfError) {
      throw createError('FORBIDDEN', 'Invalid CSRF token', 403, csrfError);
    }

    const breakGlass = await assertAdminBreakGlass(req, 'finance.write', user.id);

    const body = await req.json();
    const { reason, reason_code } = assertReason(body);

    // Validation métier
    const validation = await cashoutValidators.canReject(id);
    if (!validation.valid) {
      throw createError(
        'VALIDATION_ERROR',
        'Cannot reject cashout',
        400,
        { errors: validation.errors }
      );
    }

    const admin = getAdminClient();
    const { data: cashout, error: cashoutError } = await admin
      .from('cashouts')
      .select('id, status, metadata')
      .eq('id', id)
      .single();

    if (cashoutError || !cashout) {
      throw createError('NOT_FOUND', 'Cashout not found', 404, cashoutError?.message);
    }

    if (!['requested', 'processing'].includes(cashout.status)) {
      throw createError('CONFLICT', `Cashout cannot be rejected from ${cashout.status}`, 409);
    }

    const now = new Date().toISOString();
    const metadata = {
      ...(cashout.metadata || {}),
      admin_action: 'reject',
      admin_reason: reason,
    };

    const { error: updateError } = await admin
      .from('cashouts')
      .update({ status: 'failed', metadata, processed_at: now, updated_at: now })
      .eq('id', id);

    if (updateError) {
      throw createError('DATABASE_ERROR', 'Failed to reject cashout', 500, updateError.message);
    }

    // Audit avec helper standardisé
    await auditAdminAction({
      actorId: user.id,
      action: breakGlass.required ? 'cashout_reject_break_glass' : 'cashout_reject',
      entity: 'cashouts',
      entityId: id,
      before: { status: cashout.status },
      after: { status: 'failed' },
      reason,
      reasonCode: reason_code,
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      userAgent: req.headers.get('user-agent') ?? undefined,
      metadata: breakGlass.required ? { break_glass: breakGlass } : undefined,
    });

    // Notifier le créateur
    const { data: cashoutFull } = await admin
      .from('cashouts')
      .select('creator_id')
      .eq('id', id)
      .single();
    
    if (cashoutFull?.creator_id) {
      await notifyAdminAction({
        userId: cashoutFull.creator_id,
        type: 'cashout_rejected',
        data: {
          cashout_id: id,
          reason: reason,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
