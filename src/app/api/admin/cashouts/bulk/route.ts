import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { assertAdminBreakGlass } from '@/lib/admin/break-glass';
import { assertCsrf } from '@/lib/csrf';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { enforceNotReadOnly } from '@/lib/admin/middleware-readonly';
import { logAdminAction } from '@/lib/admin/audit';
import { cashoutValidators } from '@/lib/admin/validators';
import { notifyAdminAction } from '@/lib/admin/notifications';
import { createError, formatErrorResponse } from '@/lib/errors';

const BulkActionSchema = z.object({
  cashout_ids: z.array(z.string().uuid()).min(1).max(50),
  action: z.enum(['approve', 'reject']),
  reason: z.string().max(500).optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAdminPermission('finance.write');
    await enforceNotReadOnly(req, user.id);
    await enforceAdminRateLimit(req, { route: 'admin:cashouts:bulk', max: 10, windowMs: 60_000 }, user.id);
    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch (csrfError) {
      throw createError('FORBIDDEN', 'Invalid CSRF token', 403, csrfError);
    }

    const breakGlass = await assertAdminBreakGlass(req, 'finance.write', user.id);

    const body = await req.json();
    const parsed = BulkActionSchema.safeParse(body);
    if (!parsed.success) {
      throw createError('VALIDATION_ERROR', 'Invalid payload', 400, parsed.error.flatten());
    }

    const { cashout_ids, action, reason } = parsed.data;
    const admin = getAdminClient();

    // Vérifier que tous les cashouts existent
    const { data: cashouts, error: cashoutsError } = await admin
      .from('cashouts')
      .select('id, status, creator_id, amount_cents')
      .in('id', cashout_ids);

    if (cashoutsError) {
      throw createError('DATABASE_ERROR', 'Failed to load cashouts', 500, cashoutsError.message);
    }

    if (!cashouts || cashouts.length !== cashout_ids.length) {
      throw createError('VALIDATION_ERROR', 'Some cashouts not found', 400);
    }

    // Valider chaque cashout selon l'action
    let validCashouts = cashouts;
    if (action === 'approve') {
      const validationResults = await Promise.all(
        cashouts.map(c => cashoutValidators.canApprove(c.id))
      );
      validCashouts = cashouts.filter((_, i) => validationResults[i].valid);
    } else {
      const validationResults = await Promise.all(
        cashouts.map(c => cashoutValidators.canReject(c.id))
      );
      validCashouts = cashouts.filter((_, i) => validationResults[i].valid);
    }

    if (validCashouts.length === 0) {
      throw createError('VALIDATION_ERROR', 'No cashouts can be modified', 400);
    }

    const validIds = validCashouts.map(c => c.id);
    const now = new Date().toISOString();
    const newStatus = action === 'approve' ? 'processing' : 'failed';

    // Pour approve, utiliser RPC avec transaction pour chaque cashout
    // Pour reject, faire une mise à jour simple
    if (action === 'approve') {
      // Approuver un par un via RPC pour garantir les transactions
      const results = await Promise.allSettled(
        validIds.map(id =>
          admin.rpc('admin_approve_cashout', {
            p_cashout_id: id,
            p_actor_id: user.id,
            p_reason: reason,
          })
        )
      );

      const successfulIds: string[] = [];
      const failed = results.filter(r => r.status === 'rejected').length;
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successfulIds.push(validIds[index]);
        }
      });

      // Notifier les créateurs des cashouts approuvés
      const successfulCashouts = validCashouts.filter((_, i) => 
        results[i]?.status === 'fulfilled'
      );
      
      const creatorNotifications = new Map<string, { cashout_ids: string[]; amounts: number[] }>();
      for (const cashout of successfulCashouts) {
        if (!cashout.creator_id) continue;
        const existing = creatorNotifications.get(cashout.creator_id) || { cashout_ids: [], amounts: [] };
        existing.cashout_ids.push(cashout.id);
        existing.amounts.push(cashout.amount_cents);
        creatorNotifications.set(cashout.creator_id, existing);
      }

      // Notifier chaque créateur
      const notificationPromises = Array.from(creatorNotifications.entries()).map(([creatorId, data]) => {
        return notifyAdminAction({
          userId: creatorId,
          type: 'cashout_approved',
          data: {
            cashout_id: data.cashout_ids[0],
            amount_cents: data.amounts.reduce((sum, amt) => sum + amt, 0),
          },
        });
      });

      await Promise.allSettled(notificationPromises);

      // Audit log global
      await logAdminAction({
        actorId: user.id,
        action: 'cashouts_bulk_approve',
        tableName: 'cashouts',
        rowPk: successfulIds.join(','),
        newValues: {
          action: 'approve',
          count: successfulIds.length,
          failed,
          total_requested: cashout_ids.length,
          ...(breakGlass.required ? { break_glass: breakGlass } : {}),
        },
        ip: req.headers.get('x-forwarded-for') ?? undefined,
        userAgent: req.headers.get('user-agent') ?? undefined,
      });

      return NextResponse.json({
        ok: true,
        results: {
          total_requested: cashout_ids.length,
          processed: successfulIds.length,
          failed,
          skipped: cashout_ids.length - validIds.length,
          action: 'approve',
        },
      });
    } else {
      // Reject en batch
      const { error: updateError } = await admin
        .from('cashouts')
        .update({
          status: newStatus,
          metadata: { admin_action: 'reject', admin_reason: reason },
          processed_at: now,
          updated_at: now,
        })
        .in('id', validIds);

      if (updateError) {
        throw createError('DATABASE_ERROR', 'Failed to reject cashouts', 500, updateError.message);
      }

      // Status history
      const statusHistoryInserts = validCashouts.map(c => ({
        table_name: 'cashouts',
        row_id: c.id,
        old_status: c.status,
        new_status: newStatus,
        changed_by: user.id,
        reason: reason || null,
      }));

      if (statusHistoryInserts.length > 0) {
        await admin.from('status_history').insert(statusHistoryInserts);
      }

      // Audit logs
      const auditLogInserts = validCashouts.map(c => ({
        actor_id: user.id,
        action: 'cashout_reject',
        table_name: 'cashouts',
        row_pk: c.id,
        old_values: { status: c.status },
        new_values: { status: newStatus, reason },
        ip: req.headers.get('x-forwarded-for') ?? undefined,
        user_agent: req.headers.get('user-agent') ?? undefined,
      }));

      if (auditLogInserts.length > 0) {
        await admin.from('audit_logs').insert(auditLogInserts);
      }

      // Audit log global
      await logAdminAction({
        actorId: user.id,
        action: 'cashouts_bulk_reject',
        tableName: 'cashouts',
        rowPk: validIds.join(','),
        newValues: {
          action: 'reject',
          count: validIds.length,
          total_requested: cashout_ids.length,
        },
        ip: req.headers.get('x-forwarded-for') ?? undefined,
        userAgent: req.headers.get('user-agent') ?? undefined,
      });

      // Notifier les créateurs
      const creatorNotifications = new Map<string, { cashout_ids: string[] }>();
      for (const cashout of validCashouts) {
        if (!cashout.creator_id) continue;
        const existing = creatorNotifications.get(cashout.creator_id) || { cashout_ids: [] };
        existing.cashout_ids.push(cashout.id);
        creatorNotifications.set(cashout.creator_id, existing);
      }

      // Notifier chaque créateur
      const notificationPromises = Array.from(creatorNotifications.entries()).map(([creatorId, data]) => {
        return notifyAdminAction({
          userId: creatorId,
          type: 'cashout_rejected',
          data: {
            cashout_id: data.cashout_ids[0],
            reason: reason || undefined,
          },
        });
      });

      await Promise.allSettled(notificationPromises);

      return NextResponse.json({
        ok: true,
        results: {
          total_requested: cashout_ids.length,
          processed: validIds.length,
          skipped: cashout_ids.length - validIds.length,
          action: 'reject',
        },
      });
    }
  } catch (error) {
    return formatErrorResponse(error);
  }
}

