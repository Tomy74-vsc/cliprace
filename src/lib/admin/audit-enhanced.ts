import { getAdminClient } from './supabase';

type AuditAdminActionParams = {
  actorId: string;
  action: string;
  entity: string;
  entityId: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string;
  reasonCode?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Helper standardisé pour audit des actions admin
 * 
 * Écrit dans audit_logs ET status_history si changement de statut
 */
export async function auditAdminAction({
  actorId,
  action,
  entity,
  entityId,
  before,
  after,
  reason,
  reasonCode,
  ip,
  userAgent,
  metadata,
}: AuditAdminActionParams) {
  const admin = getAdminClient();
  const now = new Date().toISOString();

  // Détecter changement de statut
  const statusChanged =
    before && after && 'status' in before && 'status' in after && before.status !== after.status;

  // Écrire dans audit_logs
  await admin.from('audit_logs').insert({
    actor_id: actorId,
    action,
    table_name: entity,
    row_pk: entityId,
    old_values: before || null,
    new_values: {
      ...(after || {}),
      ...(reason ? { reason } : {}),
      ...(reasonCode ? { reason_code: reasonCode } : {}),
      ...(metadata || {}),
    },
    ip: ip || null,
    user_agent: userAgent || null,
    created_at: now,
  });

  // Écrire dans status_history si changement de statut
  if (statusChanged && entityId) {
    await admin.from('status_history').insert({
      table_name: entity,
      row_id: entityId,
      old_status: String(before.status),
      new_status: String(after.status),
      changed_by: actorId,
      reason: reason || null,
      reason_code: reasonCode || null,
      created_at: now,
    });
  }
}

