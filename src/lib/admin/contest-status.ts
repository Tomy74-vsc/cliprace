import { getAdminClient } from '@/lib/admin/supabase';
import { createError } from '@/lib/errors';

export type ContestStatus = 'draft' | 'active' | 'paused' | 'ended' | 'archived';

interface UpdateContestStatusInput {
  contestId: string;
  newStatus: ContestStatus;
  actorId: string;
  action: string;
  reason?: string;
  reasonCode?: string;
  ip?: string;
  userAgent?: string;
  allowedFrom?: ContestStatus[];
}

export async function updateContestStatus({
  contestId,
  newStatus,
  actorId,
  action,
  reason,
  reasonCode,
  ip,
  userAgent,
  allowedFrom,
}: UpdateContestStatusInput) {
  const admin = getAdminClient();
  const { data: contest, error: contestError } = await admin
    .from('contests')
    .select('id, status')
    .eq('id', contestId)
    .single();

  if (contestError || !contest) {
    throw createError('NOT_FOUND', 'Contest not found', 404, contestError?.message);
  }

  const oldStatus = contest.status as ContestStatus;

  if (allowedFrom && !allowedFrom.includes(oldStatus)) {
    throw createError(
      'CONFLICT',
      `Contest cannot transition from ${oldStatus} to ${newStatus}`,
      409
    );
  }
  if (oldStatus === newStatus) {
    return { oldStatus, newStatus };
  }

  const { error: updateError } = await admin
    .from('contests')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', contestId);

  if (updateError) {
    throw createError('DATABASE_ERROR', 'Contest update failed', 500, updateError.message);
  }

  await admin.from('status_history').insert({
    table_name: 'contests',
    row_id: contestId,
    old_status: oldStatus,
    new_status: newStatus,
    changed_by: actorId,
    reason: reason || null,
    reason_code: reasonCode || null,
  });

  await admin.from('audit_logs').insert({
    actor_id: actorId,
    action,
    table_name: 'contests',
    row_pk: contestId,
    old_values: { status: oldStatus },
    new_values: {
      status: newStatus,
      ...(reason ? { reason } : {}),
      ...(reasonCode ? { reason_code: reasonCode } : {}),
    },
    ip,
    user_agent: userAgent,
  });

  return { oldStatus, newStatus };
}
