import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { assertCsrf } from '@/lib/csrf';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { enforceNotReadOnly } from '@/lib/admin/middleware-readonly';
import { logAdminAction } from '@/lib/admin/audit';
import { moderationValidators } from '@/lib/admin/validators';
import { createError, formatErrorResponse } from '@/lib/errors';

const BulkActionSchema = z.object({
  queue_item_ids: z.array(z.string().uuid()).min(1).max(100),
  action: z.enum(['claim', 'release']),
});

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAdminPermission('moderation.write');
    await enforceNotReadOnly(req, user.id);
    await enforceAdminRateLimit(req, { route: 'admin:moderation:queue:bulk', max: 10, windowMs: 60_000 }, user.id);
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

    const { queue_item_ids, action } = parsed.data;
    const admin = getAdminClient();
    const now = new Date().toISOString();

    // Vérifier que tous les items existent
    const { data: queueItems, error: queueError } = await admin
      .from('moderation_queue')
      .select('id, status, reviewed_by')
      .in('id', queue_item_ids);

    if (queueError) {
      throw createError('DATABASE_ERROR', 'Failed to load queue items', 500, queueError.message);
    }

    if (!queueItems || queueItems.length !== queue_item_ids.length) {
      throw createError('VALIDATION_ERROR', 'Some queue items not found', 400);
    }

    // Valider chaque item selon l'action
    let validItems = queueItems;
    if (action === 'claim') {
      const validationResults = await Promise.all(
        queueItems.map(item => moderationValidators.canClaim(item.id, user.id))
      );
      validItems = queueItems.filter((_, i) => validationResults[i].valid);
    } else {
      const validationResults = await Promise.all(
        queueItems.map(item => moderationValidators.canRelease(item.id, user.id))
      );
      validItems = queueItems.filter((_, i) => validationResults[i].valid);
    }

    if (validItems.length === 0) {
      throw createError('VALIDATION_ERROR', 'No queue items can be modified', 400);
    }

    const validIds = validItems.map(item => item.id);

    // Mettre à jour en batch
    if (action === 'claim') {
      const { error: updateError } = await admin
        .from('moderation_queue')
        .update({
          status: 'processing',
          reviewed_by: user.id,
          reviewed_at: now,
          updated_at: now,
        })
        .in('id', validIds);

      if (updateError) {
        throw createError('DATABASE_ERROR', 'Failed to claim queue items', 500, updateError.message);
      }
    } else {
      const { error: updateError } = await admin
        .from('moderation_queue')
        .update({
          status: 'pending',
          reviewed_by: null,
          reviewed_at: null,
          updated_at: now,
        })
        .in('id', validIds);

      if (updateError) {
        throw createError('DATABASE_ERROR', 'Failed to release queue items', 500, updateError.message);
      }
    }

    // Audit log
    await logAdminAction({
      actorId: user.id,
      action: `moderation_queue_bulk_${action}`,
      tableName: 'moderation_queue',
      rowPk: validIds.join(','),
      newValues: {
        action,
        count: validIds.length,
        total_requested: queue_item_ids.length,
      },
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      userAgent: req.headers.get('user-agent') ?? undefined,
    });

    const results = {
      total_requested: queue_item_ids.length,
      processed: validIds.length,
      skipped: queue_item_ids.length - validIds.length,
      action,
    };

    return NextResponse.json({ ok: true, results });
  } catch (error) {
    return formatErrorResponse(error);
  }
}

