import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { assertAdminBreakGlass } from '@/lib/admin/break-glass';
import { assertCsrf } from '@/lib/csrf';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { enforceNotReadOnly } from '@/lib/admin/middleware-readonly';
import { assertReason } from '@/lib/admin/reason';
import { auditAdminAction } from '@/lib/admin/audit-enhanced';
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
    await enforceAdminRateLimit(req, { route: 'admin:cashouts:approve', max: 10, windowMs: 60_000 }, user.id);
    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch (csrfError) {
      throw createError('FORBIDDEN', 'Invalid CSRF token', 403, csrfError);
    }

    const breakGlass = await assertAdminBreakGlass(req, 'finance.write', user.id);
    const body = await req.json().catch(() => ({}));
    const { reason, reason_code } = assertReason(body);

    const admin = getAdminClient();
    
    // Récupérer l'état avant pour audit
    const { data: before } = await admin
      .from('cashouts')
      .select('id, status, amount_cents, creator_id')
      .eq('id', id)
      .single();
    
    // Utiliser fonction RPC avec transaction
    const { data, error } = await admin.rpc('admin_approve_cashout', {
      p_cashout_id: id,
      p_actor_id: user.id,
      p_reason: reason,
    });

    if (error) {
      // Les erreurs SQL sont déjà formatées par la fonction
      throw createError('DATABASE_ERROR', error.message, 500, error);
    }

    // Récupérer l'état après pour audit
    const { data: after } = await admin
      .from('cashouts')
      .select('id, status, amount_cents')
      .eq('id', id)
      .single();

    // Audit avec helper standardisé
    await auditAdminAction({
      actorId: user.id,
      action: breakGlass.required ? 'cashout_approve_break_glass' : 'cashout_approve',
      entity: 'cashouts',
      entityId: id,
      before: before ? { status: before.status, amount_cents: before.amount_cents } : null,
      after: after ? { status: after.status, amount_cents: after.amount_cents } : null,
      reason,
      reasonCode: reason_code,
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      userAgent: req.headers.get('user-agent') ?? undefined,
      metadata: breakGlass.required ? { break_glass: breakGlass } : undefined,
    });

    // Notifier le créateur
    const { data: cashout } = await admin
      .from('cashouts')
      .select('creator_id, amount_cents')
      .eq('id', id)
      .single();
    
    if (cashout?.creator_id) {
      await notifyAdminAction({
        userId: cashout.creator_id,
        type: 'cashout_approved',
        data: {
          cashout_id: id,
          amount_cents: cashout.amount_cents,
        },
      });
    }

    return NextResponse.json({ ok: true, ...data });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
