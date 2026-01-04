/*
Source: POST /api/submissions/batch-moderate
Tables: submissions, moderation_actions, notifications, audit_logs
Rules:
- Only brand owner of the contest or admin can moderate
- status ∈ {'approved','rejected'}; reason optional for rejected
- Process multiple submissions in batch
*/
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { getUserRole } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { assertCsrf } from '@/lib/csrf';
import { createError, formatErrorResponse } from '@/lib/errors';

const BodySchema = z.object({
  submission_ids: z.array(z.string().uuid()).min(1, 'Au moins une soumission requise'),
  status: z.enum(['approved', 'rejected', 'removed']),
  reason: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  try {
    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch {
      throw createError('FORBIDDEN', 'CSRF token invalide', 403);
    }

    const supabaseSSR = await getSupabaseSSR();
    const {
      data: { user },
    } = await supabaseSSR.auth.getUser();
    if (!user) {
      throw createError('UNAUTHORIZED', 'Authentification requise', 401);
    }

    const role = await getUserRole(user.id);
    if (!role) {
      throw createError('FORBIDDEN', 'Accès refusé', 403);
    }

    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      throw createError('VALIDATION_ERROR', 'Payload invalide', 400, parsed.error.flatten());
    }

    const { submission_ids, status, reason } = parsed.data;
    if ((status === 'rejected' || status === 'removed') && !reason) {
      throw createError('VALIDATION_ERROR', 'Reason required for rejection/removal', 400);
    }

    const admin = getSupabaseAdmin();
    const now = new Date().toISOString();
    const ip = req.headers.get('x-forwarded-for') ?? undefined;
    const ua = req.headers.get('user-agent') ?? undefined;

    // Vérifier que toutes les soumissions appartiennent à des concours de la marque
    const { data: submissions, error: subErr } = await admin
      .from('submissions')
      .select('id, contest_id, creator_id, status, rejection_reason')
      .in('id', submission_ids);

    if (subErr || !submissions || submissions.length === 0) {
      throw createError('NOT_FOUND', 'Soumissions non trouvées', 404);
    }

    // Vérifier l'ownership des concours
    const contestIds = [...new Set(submissions.map((s) => s.contest_id))];
    const { data: contests, error: contestErr } = await admin
      .from('contests')
      .select('id, brand_id')
      .in('id', contestIds);

    if (contestErr || !contests) {
      throw createError('DATABASE_ERROR', 'Erreur lors de la vérification des concours', 500);
    }

    const isAdmin = role === 'admin';
    const contestsByBrand = new Map(contests.map((c) => [c.id, c.brand_id]));
    
    // Vérifier que toutes les soumissions appartiennent à des concours de la marque
    for (const submission of submissions) {
      const brandId = contestsByBrand.get(submission.contest_id);
      if (!brandId) {
        throw createError('NOT_FOUND', 'Concours non trouvé', 404);
      }
      if (!isAdmin && brandId !== user.id) {
        throw createError('FORBIDDEN', 'Accès refusé à ce concours', 403);
      }
    }

    // Filtrer uniquement les soumissions en attente
    const pendingSubmissions = submissions.filter((s) => s.status === 'pending');
    if (pendingSubmissions.length === 0) {
      throw createError('VALIDATION_ERROR', 'Aucune soumission en attente à modérer', 400);
    }

    const updatePayload: Record<string, any> = {
      status,
      moderated_by: user.id,
      updated_at: now,
    };
    if (status === 'approved') {
      updatePayload.rejection_reason = null;
      updatePayload.approved_at = now;
    } else {
      updatePayload.rejection_reason = reason ?? null;
      updatePayload.approved_at = null;
    }

    // Mettre à jour toutes les soumissions
    const { error: updErr } = await admin
      .from('submissions')
      .update(updatePayload)
      .in('id', pendingSubmissions.map((s) => s.id));

    if (updErr) {
      throw createError('DATABASE_ERROR', 'Erreur lors de la mise à jour', 500, updErr.message);
    }

    // Update moderation queue status
    await admin
      .from('moderation_queue')
      .update({
        status: 'completed',
        reviewed_by: user.id,
        reviewed_at: now,
        updated_at: now,
      })
      .in('submission_id', pendingSubmissions.map((s) => s.id));
    // Créer les actions de modération
    const moderationActions = pendingSubmissions.map((sub) => ({
      target_table: 'submissions',
      target_id: sub.id,
      action: status === 'approved' ? 'approve' : status === 'removed' ? 'remove' : 'reject',
      reason: reason ?? null,
      actor_id: user.id,
      created_at: now,
    }));

    await admin.from('moderation_actions').insert(moderationActions);

    // Notifier les créateurs
    const { notifyCreatorAboutModeration } = await import('@/lib/notifications');
    await Promise.all(
      pendingSubmissions.map((sub) =>
        notifyCreatorAboutModeration(
          sub.creator_id,
          sub.id,
          sub.contest_id,
          status,
          reason ?? null,
          admin
        )
      )
    );

    // Audit logs
    const auditLogs = pendingSubmissions.map((sub) => ({
      actor_id: user.id,
      action: 'submission_moderate',
      table_name: 'submissions',
      row_pk: sub.id,
      old_values: { status: sub.status, rejection_reason: sub.rejection_reason },
      new_values: updatePayload,
      ip,
      user_agent: ua,
      created_at: now,
    }));

    await admin.from('audit_logs').insert(auditLogs);

    return NextResponse.json({
      ok: true,
      moderated_count: pendingSubmissions.length,
    });
  } catch (error) {
    return formatErrorResponse(error);
  }
}


