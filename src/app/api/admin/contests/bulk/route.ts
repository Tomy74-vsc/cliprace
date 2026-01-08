import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { assertCsrf } from '@/lib/csrf';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { enforceNotReadOnly } from '@/lib/admin/middleware-readonly';
import { logAdminAction } from '@/lib/admin/audit';
import { contestValidators } from '@/lib/admin/validators';
import { notifyAdminAction } from '@/lib/admin/notifications';
import { createError, formatErrorResponse } from '@/lib/errors';

const BulkActionSchema = z.object({
  contest_ids: z.array(z.string().uuid()).min(1).max(50),
  action: z.enum(['publish', 'pause']),
});

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAdminPermission('contests.write');
    await enforceNotReadOnly(req, user.id);
    await enforceAdminRateLimit(req, { route: 'admin:contests:bulk', max: 10, windowMs: 60_000 }, user.id);
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

    const { contest_ids, action } = parsed.data;
    const admin = getAdminClient();
    const now = new Date().toISOString();

    // Vérifier que tous les contests existent
    const { data: contests, error: contestsError } = await admin
      .from('contests')
      .select('id, status, brand_id, title')
      .in('id', contest_ids);

    if (contestsError) {
      throw createError('DATABASE_ERROR', 'Failed to load contests', 500, contestsError.message);
    }

    if (!contests || contests.length !== contest_ids.length) {
      throw createError('VALIDATION_ERROR', 'Some contests not found', 400);
    }

    // Filtrer les contests qui peuvent être modifiés
    let validContests = contests;
    if (action === 'publish') {
      // Pour publish, valider chaque contest
      const validationResults = await Promise.all(
        contests.map(c => contestValidators.canPublish(c.id))
      );
      validContests = contests.filter((_, i) => validationResults[i].valid);
    } else {
      // Pour pause, vérifier le statut
      const validationResults = await Promise.all(
        contests.map(c => contestValidators.canPause(c.id))
      );
      validContests = contests.filter((_, i) => validationResults[i].valid);
    }

    if (validContests.length === 0) {
      throw createError('VALIDATION_ERROR', 'No contests can be modified', 400);
    }

    const newStatus = action === 'publish' ? 'active' : 'paused';
    const validIds = validContests.map(c => c.id);

    // Mettre à jour en batch
    const { error: updateError } = await admin
      .from('contests')
      .update({ status: newStatus, updated_at: now })
      .in('id', validIds);

    if (updateError) {
      throw createError('DATABASE_ERROR', 'Failed to update contests', 500, updateError.message);
    }

    // Créer status_history et audit logs pour chaque contest
    const statusHistoryInserts = validContests.map(c => ({
      table_name: 'contests',
      row_id: c.id,
      old_status: c.status,
      new_status: newStatus,
      changed_by: user.id,
    }));

    if (statusHistoryInserts.length > 0) {
      await admin.from('status_history').insert(statusHistoryInserts);
    }

    // Audit logs
    const auditLogInserts = validContests.map(c => ({
      actor_id: user.id,
      action: `contest_bulk_${action}`,
      table_name: 'contests',
      row_pk: c.id,
      old_values: { status: c.status },
      new_values: { status: newStatus },
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    }));

    if (auditLogInserts.length > 0) {
      await admin.from('audit_logs').insert(auditLogInserts);
    }

    // Audit log global
    await logAdminAction({
      actorId: user.id,
      action: `contests_bulk_${action}`,
      tableName: 'contests',
      rowPk: validIds.join(','),
      newValues: {
        action,
        count: validIds.length,
        total_requested: contest_ids.length,
      },
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      userAgent: req.headers.get('user-agent') ?? undefined,
    });

    // Notifier les brand owners
    const brandNotifications = new Map<string, { contest_ids: string[]; contest_titles: Set<string> }>();
    for (const contest of validContests) {
      if (!contest.brand_id) continue;
      const existing = brandNotifications.get(contest.brand_id) || { contest_ids: [], contest_titles: new Set<string>() };
      existing.contest_ids.push(contest.id);
      if (contest.title) {
        existing.contest_titles.add(contest.title);
      }
      brandNotifications.set(contest.brand_id, existing);
    }

    // Notifier chaque brand owner
    const notificationPromises = Array.from(brandNotifications.entries()).map(([brandId, data]) => {
      const contestTitle = data.contest_titles.size === 1 
        ? Array.from(data.contest_titles)[0]
        : undefined;
      
      return notifyAdminAction({
        userId: brandId,
        type: action === 'publish' ? 'contest_published' : 'contest_paused',
        data: {
          contest_id: data.contest_ids[0],
          contest_title: contestTitle,
        },
      });
    });

    await Promise.allSettled(notificationPromises);

    const results = {
      total_requested: contest_ids.length,
      processed: validIds.length,
      skipped: contest_ids.length - validIds.length,
      action,
    };

    return NextResponse.json({ ok: true, results });
  } catch (error) {
    return formatErrorResponse(error);
  }
}

