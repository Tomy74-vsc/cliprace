import { getAdminClient } from '@/lib/admin/supabase';

export interface LogAdminActionParams {
  actorId: string;
  action: string;
  tableName: string;
  rowPk: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export async function logAdminAction(params: LogAdminActionParams) {
  const admin = getAdminClient();
  
  await admin.from('audit_logs').insert({
    actor_id: params.actorId,
    action: params.action,
    table_name: params.tableName,
    row_pk: params.rowPk,
    old_values: params.oldValues ?? null,
    new_values: params.newValues ?? null,
    ip: params.ip,
    user_agent: params.userAgent,
    metadata: params.metadata ?? null,
  });
}

export interface LogStatusChangeParams {
  tableName: string;
  rowId: string;
  oldStatus: string;
  newStatus: string;
  changedBy: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export async function logStatusChange(params: LogStatusChangeParams) {
  const admin = getAdminClient();
  
  await admin.from('status_history').insert({
    table_name: params.tableName,
    row_id: params.rowId,
    old_status: params.oldStatus,
    new_status: params.newStatus,
    changed_by: params.changedBy,
    reason: params.reason ?? null,
    metadata: params.metadata ?? null,
  });
}

// Helper combiné pour actions avec changement de statut
export async function logAdminActionWithStatus(
  actionParams: LogAdminActionParams,
  statusParams: LogStatusChangeParams
) {
  await Promise.all([
    logAdminAction(actionParams),
    logStatusChange(statusParams),
  ]);
}

