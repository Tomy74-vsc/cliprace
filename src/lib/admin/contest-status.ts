import { getAdminClient } from '@/lib/admin/supabase';
import { createError } from '@/lib/errors';

export type ContestStatus =
  | 'draft'
  | 'pending_live'   // payé, en attente activation (24h)
  | 'active'         // 12 jours, créateurs participent
  | 'reviewing'      // 2 jours, modération finale brand
  | 'paused'
  | 'ended'
  | 'archived';

/** Durées fixes du lifecycle (en millisecondes) */
export const CONTEST_DURATIONS = {
  PENDING_LIVE_MS: 24 * 60 * 60 * 1000,       // 24h
  ACTIVE_MS: 12 * 24 * 60 * 60 * 1000,        // 12 jours
  REVIEWING_MS: 2 * 24 * 60 * 60 * 1000,      // 2 jours
} as const;

/** Transitions autorisées */
export const CONTEST_TRANSITIONS: Record<ContestStatus, ContestStatus[]> = {
  draft:        ['pending_live'],
  pending_live: ['active'],
  active:       ['reviewing', 'paused'],
  reviewing:    ['ended'],
  paused:       ['active', 'ended'],
  ended:        ['archived'],
  archived:     [],
};

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
      409,
    );
  }
  if (oldStatus === newStatus) {
    return { oldStatus, newStatus };
  }

  const dateUpdates: Record<string, string> = {};

  if (newStatus === 'pending_live') {
    const liveAt = new Date(Date.now() + CONTEST_DURATIONS.PENDING_LIVE_MS);
    dateUpdates.live_at = liveAt.toISOString();
  }

  if (newStatus === 'active') {
    const reviewingAt = new Date(Date.now() + CONTEST_DURATIONS.ACTIVE_MS);
    dateUpdates.start_at = new Date().toISOString();
    dateUpdates.reviewing_at = reviewingAt.toISOString();
  }

  if (newStatus === 'reviewing') {
    const endsAt = new Date(Date.now() + CONTEST_DURATIONS.REVIEWING_MS);
    dateUpdates.ends_at = endsAt.toISOString();
  }

  if (newStatus === 'ended') {
    dateUpdates.end_at = new Date().toISOString();
  }

  const { error: updateError } = await admin
    .from('contests')
    .update({
      status: newStatus,
      updated_at: new Date().toISOString(),
      ...dateUpdates,
    })
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
