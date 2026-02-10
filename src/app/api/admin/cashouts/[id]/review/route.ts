import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { assertAdminBreakGlass } from '@/lib/admin/break-glass';
import { assertCsrf } from '@/lib/csrf';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { enforceNotReadOnly } from '@/lib/admin/middleware-readonly';
import { auditAdminAction } from '@/lib/admin/audit-enhanced';
import { createError, formatErrorResponse } from '@/lib/errors';

const ReviewSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  reason: z.string().min(8).max(500),
  reason_code: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // Vérification stricte: nécessite un utilisateur avec rôle "admin"
    // (enforcée par requireAdminPermission -> requireAdminUser)
    const { user } = await requireAdminPermission('finance.write');

    await enforceNotReadOnly(req, user.id);
    await enforceAdminRateLimit(req, { route: 'admin:cashouts:review', max: 20, windowMs: 60_000 }, user.id);

    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch (csrfError) {
      throw createError('FORBIDDEN', 'Invalid CSRF token', 403, csrfError);
    }

    const breakGlass = await assertAdminBreakGlass(req, 'finance.write', user.id);
    const body = await req.json();
    const parsed = ReviewSchema.safeParse(body);
    if (!parsed.success) {
      throw createError('VALIDATION_ERROR', 'Invalid payload', 400, parsed.error.flatten());
    }

    const { decision, reason, reason_code } = parsed.data;
    const admin = getAdminClient();

    // Charger l'état courant pour meilleures erreurs + audit
    const { data: beforeCashout, error: loadError } = await admin
      .from('cashouts')
      .select('id, status, review_state, amount_cents, creator_id')
      .eq('id', id)
      .maybeSingle();

    if (loadError) {
      throw createError('DATABASE_ERROR', 'Failed to load cashout', 500, loadError.message);
    }

    if (!beforeCashout) {
      throw createError('NOT_FOUND', 'Cashout not found', 404);
    }

    if (beforeCashout.status === 'paid') {
      throw createError('CONFLICT', 'Cashout already paid', 409);
    }

    // Appel RPC transactionnel: centralise la logique métier côté DB
    const { error: rpcError } = await admin.rpc('admin_review_cashout', {
      p_cashout_id: id,
      p_actor_id: user.id,
      p_decision: decision,
      p_reason: reason,
    });

    if (rpcError) {
      const message = (rpcError.message || '').toLowerCase();

      if (message.includes('cashout not found')) {
        throw createError('NOT_FOUND', 'Cashout not found', 404, rpcError.message);
      }
      if (message.includes('actor is not admin')) {
        throw createError('FORBIDDEN', 'Accès admin requis', 403, rpcError.message);
      }
      if (message.includes('already') || message.includes('paid')) {
        throw createError('CONFLICT', 'Cashout cannot be reviewed in its current state', 409, rpcError.message);
      }

      throw createError('DATABASE_ERROR', 'Failed to review cashout', 500, rpcError.message);
    }

    // Récupérer l'état après + les reviews pour la réponse et l'audit
    const [{ data: afterCashout, error: afterError }, { data: reviews, error: reviewsError }] =
      await Promise.all([
        admin
          .from('cashouts')
          .select('id, status, review_state, amount_cents')
          .eq('id', id)
          .maybeSingle(),
        admin
          .from('cashout_reviews')
          .select('admin_id, decision')
          .eq('cashout_id', id),
      ]);

    if (afterError) {
      throw createError('DATABASE_ERROR', 'Failed to load cashout after review', 500, afterError.message);
    }
    if (reviewsError) {
      throw createError('DATABASE_ERROR', 'Failed to load cashout reviews', 500, reviewsError.message);
    }

    const approveCount = (reviews || []).filter((r) => r.decision === 'approve').length;
    const rejectCount = (reviews || []).filter((r) => r.decision === 'reject').length;
    const totalReviews = (reviews || []).length;

    const reviewState =
      afterCashout?.review_state ?? beforeCashout.review_state ?? 'pending';

    // Audit complet de l'action
    await auditAdminAction({
      actorId: user.id,
      action: `cashout_review_${decision}`,
      entity: 'cashouts',
      entityId: id,
      before: beforeCashout
        ? {
            status: beforeCashout.status,
            review_state: beforeCashout.review_state ?? 'pending',
          }
        : null,
      after: afterCashout
        ? {
            status: afterCashout.status,
            review_state: reviewState,
          }
        : null,
      reason,
      reasonCode: reason_code,
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      userAgent: req.headers.get('user-agent') ?? undefined,
      metadata: {
        approve_count: approveCount,
        reject_count: rejectCount,
        total_reviews: totalReviews,
        ...(breakGlass.required ? { break_glass: breakGlass } : {}),
      },
    });

    return NextResponse.json({
      ok: true,
      review_state: reviewState,
      approve_count: approveCount,
      reject_count: rejectCount,
      total_reviews: totalReviews,
    });
  } catch (error) {
    return formatErrorResponse(error);
  }
}

