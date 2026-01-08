import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { assertCsrf } from '@/lib/csrf';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { enforceNotReadOnly } from '@/lib/admin/middleware-readonly';
import { logAdminAction } from '@/lib/admin/audit';
import { notifyAdminActionBulk } from '@/lib/admin/notifications';
import { createError, formatErrorResponse } from '@/lib/errors';

const BulkActionSchema = z.object({
  user_ids: z.array(z.string().uuid()).min(1).max(100),
  action: z.enum(['activate', 'deactivate']),
});

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAdminPermission('users.write');
    await enforceNotReadOnly(req, user.id);
    await enforceAdminRateLimit(req, { route: 'admin:users:bulk', max: 10, windowMs: 60_000 }, user.id);
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

    const { user_ids, action } = parsed.data;
    const admin = getAdminClient();
    const now = new Date().toISOString();

    // Ne pas permettre de désactiver son propre compte
    const filteredUserIds = user_ids.filter(id => id !== user.id || action === 'activate');

    if (filteredUserIds.length === 0) {
      throw createError('VALIDATION_ERROR', 'No valid users to process', 400);
    }

    // Vérifier que tous les utilisateurs existent
    const { data: profiles, error: profilesError } = await admin
      .from('profiles')
      .select('id, is_active')
      .in('id', filteredUserIds);

    if (profilesError) {
      throw createError('DATABASE_ERROR', 'Failed to load users', 500, profilesError.message);
    }

    if (!profiles || profiles.length !== filteredUserIds.length) {
      throw createError('VALIDATION_ERROR', 'Some users not found', 400);
    }

    const newIsActive = action === 'activate';
    const validProfiles = profiles.filter(p => p.is_active !== newIsActive);

    if (validProfiles.length === 0) {
      throw createError('VALIDATION_ERROR', 'No users need status change', 400);
    }

    const validIds = validProfiles.map(p => p.id);

    // Mettre à jour en batch
    const { error: updateError } = await admin
      .from('profiles')
      .update({ is_active: newIsActive, updated_at: now })
      .in('id', validIds);

    if (updateError) {
      throw createError('DATABASE_ERROR', 'Failed to update users', 500, updateError.message);
    }

    // Créer status_history pour chaque utilisateur
    const statusHistoryInserts = validProfiles.map(p => ({
      table_name: 'profiles',
      row_id: p.id,
      old_status: p.is_active ? 'active' : 'inactive',
      new_status: newIsActive ? 'active' : 'inactive',
      changed_by: user.id,
    }));

    if (statusHistoryInserts.length > 0) {
      await admin.from('status_history').insert(statusHistoryInserts);
    }

    // Audit log
    await logAdminAction({
      actorId: user.id,
      action: `users_bulk_${action}`,
      tableName: 'profiles',
      rowPk: validIds.join(','),
      newValues: {
        action,
        count: validIds.length,
        total_requested: user_ids.length,
      },
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      userAgent: req.headers.get('user-agent') ?? undefined,
    });

    // Notifier les utilisateurs
    await notifyAdminActionBulk({
      userIds: validIds,
      type: action === 'activate' ? 'user_activated' : 'user_deactivated',
      data: {
        user_id: validIds[0], // Structure requise, mais on notifie tous les userIds
      },
    });

    const results = {
      total_requested: user_ids.length,
      processed: validIds.length,
      skipped: user_ids.length - validIds.length,
      self_skipped: user_ids.length - filteredUserIds.length,
      action,
    };

    return NextResponse.json({ ok: true, results });
  } catch (error) {
    return formatErrorResponse(error);
  }
}

