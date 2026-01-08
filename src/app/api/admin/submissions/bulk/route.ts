import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { assertCsrf } from '@/lib/csrf';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { enforceNotReadOnly } from '@/lib/admin/middleware-readonly';
import { assertReason } from '@/lib/admin/reason';
import { auditAdminAction } from '@/lib/admin/audit-enhanced';
import { notifyAdminActionBulk } from '@/lib/admin/notifications';
import { createError, formatErrorResponse } from '@/lib/errors';

const BulkActionSchema = z.object({
  submission_ids: z.array(z.string().uuid()).min(1).max(100),
  action: z.enum(['approve', 'reject']),
  reason: z.string().min(8).max(500),
  reason_code: z.enum(['other', 'fraud', 'policy_violation', 'quality_issue', 'duplicate', 'spam', 'user_request', 'system_error', 'maintenance']).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAdminPermission('submissions.write');
    await enforceNotReadOnly(req, user.id);
    await enforceAdminRateLimit(req, { route: 'admin:submissions:bulk', max: 10, windowMs: 60_000 }, user.id);
    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch (csrfError) {
      throw createError('FORBIDDEN', 'Invalid CSRF token', 403, csrfError);
    }

    const body = await req.json();
    const parsed = BulkActionSchema.safeParse(body);
    if (!parsed.success) {
      throw createError('VALIDATION_ERROR', 'Invalid payload', 400, parsed.error.flatten());
    }

    // Valider reason obligatoire
    const { reason, reason_code } = assertReason(body);

    const { submission_ids, action } = parsed.data;
    const admin = getAdminClient();
    const now = new Date().toISOString();

    // Vérifier que toutes les submissions existent et sont dans un état modifiable
    const { data: submissions, error: submissionsError } = await admin
      .from('submissions')
      .select('id, status, contest_id, creator_id, contest:contests(id, title)')
      .in('id', submission_ids);

    if (submissionsError) {
      throw createError('DATABASE_ERROR', 'Failed to load submissions', 500, submissionsError.message);
    }

    if (!submissions || submissions.length !== submission_ids.length) {
      throw createError('VALIDATION_ERROR', 'Some submissions not found', 400);
    }

    // Filtrer les submissions qui peuvent être modifiées
    const validSubmissions = submissions.filter(
      s => action === 'approve' 
        ? s.status === 'pending' || s.status === 'rejected'
        : s.status === 'pending' || s.status === 'approved'
    );

    if (validSubmissions.length === 0) {
      throw createError('VALIDATION_ERROR', 'No submissions can be modified', 400);
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const updateData: Record<string, unknown> = {
      status: newStatus,
      updated_at: now,
    };

    if (action === 'approve') {
      updateData.approved_at = now;
    } else {
      updateData.rejection_reason = reason || null;
    }

    // Mettre à jour en batch
    const validIds = validSubmissions.map(s => s.id);
    const { error: updateError } = await admin
      .from('submissions')
      .update(updateData)
      .in('id', validIds);

    if (updateError) {
      throw createError('DATABASE_ERROR', 'Failed to update submissions', 500, updateError.message);
    }

    // Créer status_history pour chaque submission
    const statusHistoryInserts = validSubmissions.map(s => ({
      table_name: 'submissions',
      row_id: s.id,
      old_status: s.status,
      new_status: newStatus,
      changed_by: user.id,
      reason: reason || null,
    }));

    if (statusHistoryInserts.length > 0) {
      await admin.from('status_history').insert(statusHistoryInserts);
    }

    // Audit avec helper standardisé
    await auditAdminAction({
      actorId: user.id,
      action: `submissions_bulk_${action}`,
      entity: 'submissions',
      entityId: validIds.join(','),
      before: null, // Bulk action, pas d'état avant unique
      after: {
        action,
        count: validIds.length,
        total_requested: submission_ids.length,
        status: newStatus,
      },
      reason,
      reasonCode: reason_code,
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      userAgent: req.headers.get('user-agent') ?? undefined,
    });

    // Charger les données complètes des submissions
    const { data: fullSubmissions } = await admin
      .from('submissions')
      .select('id, creator_id, contest_id, contest:contests(id, title)')
      .in('id', validIds);

    // Notifier les créateurs
    const validSubmissionsWithData = validSubmissions.map(s => {
      const fullSubmission = fullSubmissions?.find(sub => sub.id === s.id);
      const contest = fullSubmission && 'contest' in fullSubmission 
        ? (Array.isArray(fullSubmission.contest) 
            ? fullSubmission.contest[0] 
            : fullSubmission.contest)
        : null;
      
      return {
        id: s.id,
        creator_id: fullSubmission && 'creator_id' in fullSubmission 
          ? (fullSubmission.creator_id as string | null)
          : null,
        contest_id: fullSubmission && 'contest_id' in fullSubmission
          ? (fullSubmission.contest_id as string | null)
          : null,
        contest_title: contest && 'title' in contest 
          ? (contest.title as string | null | undefined)
          : undefined,
      };
    });

    // Grouper par créateur pour éviter les doublons
    const creatorNotifications = new Map<string, { submission_ids: string[]; contest_titles: Set<string> }>();
    for (const sub of validSubmissionsWithData) {
      if (!sub.creator_id) continue;
      const existing = creatorNotifications.get(sub.creator_id) || { submission_ids: [], contest_titles: new Set<string>() };
      existing.submission_ids.push(sub.id);
      if (sub.contest_title) {
        existing.contest_titles.add(sub.contest_title);
      }
      creatorNotifications.set(sub.creator_id, existing);
    }

    // Notifier chaque créateur
    const notificationPromises = Array.from(creatorNotifications.entries()).map(([creatorId, data]) => {
      const contestTitle = data.contest_titles.size === 1 
        ? Array.from(data.contest_titles)[0]
        : undefined;
      
      const submissionData = validSubmissionsWithData.find(s => s.creator_id === creatorId);
      const contestId = submissionData?.contest_id || '';
      
      return notifyAdminActionBulk({
        userIds: [creatorId],
        type: action === 'approve' ? 'submission_approved' : 'submission_rejected',
        data: {
          submission_id: data.submission_ids[0], // Prendre le premier pour la structure
          contest_id: contestId,
          contest_title: contestTitle,
          reason: action === 'reject' ? (reason || undefined) : undefined,
        },
      });
    });

    await Promise.allSettled(notificationPromises);

    const results = {
      total_requested: submission_ids.length,
      processed: validIds.length,
      skipped: submission_ids.length - validIds.length,
      action,
    };

    return NextResponse.json({ ok: true, results });
  } catch (error) {
    return formatErrorResponse(error);
  }
}

