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

    // Vérifier que le cashout existe et est en attente
    const { data: cashout, error: cashoutError } = await admin
      .from('cashouts')
      .select('id, status, review_state, amount_cents, creator_id')
      .eq('id', id)
      .single();

    if (cashoutError || !cashout) {
      throw createError('NOT_FOUND', 'Cashout not found', 404, cashoutError?.message);
    }

    if (cashout.status !== 'requested' && cashout.status !== 'failed') {
      throw createError('CONFLICT', `Cashout cannot be reviewed from status: ${cashout.status}`, 409);
    }

    // Vérifier si l'admin a déjà approuvé/rejeté ce cashout
    const { data: existingReview } = await admin
      .from('cashout_reviews')
      .select('id, decision')
      .eq('cashout_id', id)
      .eq('admin_id', user.id)
      .maybeSingle();

    if (existingReview) {
      throw createError('CONFLICT', 'Vous avez déjà donné votre avis sur ce cashout', 409);
    }

    // Enregistrer la review
    const { error: reviewError } = await admin
      .from('cashout_reviews')
      .insert({
        cashout_id: id,
        admin_id: user.id,
        decision,
        reason,
      });

    if (reviewError) {
      throw createError('DATABASE_ERROR', 'Failed to record review', 500, reviewError.message);
    }

    // Compter les reviews
    const { data: reviews } = await admin
      .from('cashout_reviews')
      .select('admin_id, decision')
      .eq('cashout_id', id);

    const approveCount = (reviews || []).filter((r) => r.decision === 'approve').length;
    const rejectCount = (reviews || []).filter((r) => r.decision === 'reject').length;
    const totalReviews = (reviews || []).length;

    // Si 2 approvals distincts → approved
    // Si 1 reject → rejected (mais on peut continuer si pas encore 2 approvals)
    let newReviewState = 'pending';
    if (approveCount >= 2) {
      newReviewState = 'approved';
      // Approuver le cashout
      await admin.rpc('admin_approve_cashout', {
        p_cashout_id: id,
        p_actor_id: user.id,
        p_reason: reason,
      });
    } else if (rejectCount >= 1 && totalReviews >= 2) {
      newReviewState = 'rejected';
      // Rejeter le cashout
      const { error: rejectError } = await admin
        .from('cashouts')
        .update({
          status: 'failed',
          review_state: 'rejected',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (rejectError) {
        throw createError('DATABASE_ERROR', 'Failed to reject cashout', 500, rejectError.message);
      }
    }

    // Mettre à jour review_state si nécessaire
    if (newReviewState !== 'pending') {
      await admin
        .from('cashouts')
        .update({ review_state: newReviewState })
        .eq('id', id);
    }

    // Audit
    await auditAdminAction({
      actorId: user.id,
      action: `cashout_review_${decision}`,
      entity: 'cashouts',
      entityId: id,
      before: { review_state: cashout.review_state || 'pending' },
      after: {
        review_state: newReviewState,
        approve_count: approveCount,
        reject_count: rejectCount,
        total_reviews: totalReviews,
      },
      reason,
      reasonCode: reason_code,
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      userAgent: req.headers.get('user-agent') ?? undefined,
      metadata: breakGlass.required ? { break_glass: breakGlass } : undefined,
    });

    return NextResponse.json({
      ok: true,
      review_state: newReviewState,
      approve_count: approveCount,
      reject_count: rejectCount,
      needs_more_approvals: newReviewState === 'pending' && approveCount < 2,
    });
  } catch (error) {
    return formatErrorResponse(error);
  }
}

