import type { AdminAccess } from '@/lib/admin/rbac';

export type AdminTaskStatus = 'open' | 'in_progress' | 'blocked' | 'done' | 'canceled';
export type AdminTaskPriority = 'low' | 'normal' | 'high' | 'critical';

export type AdminTaskType =
  | 'support.ticket'
  | 'crm.lead'
  | 'moderation.queue'
  | 'finance.cashouts_pending'
  | 'integrations.webhooks_failed'
  | 'ingestion.errors_24h'
  | 'ingestion.jobs_failed'
  | 'risk.kyc_pending'
  | 'risk.flags_open';

export type TaskPermission = { read: string; write?: string };

export function getTaskPermission(taskType: string): TaskPermission | null {
  switch (taskType) {
    case 'support.ticket':
      return { read: 'support.read', write: 'support.write' };
    case 'crm.lead':
      return { read: 'crm.read', write: 'crm.write' };
    case 'moderation.queue':
      return { read: 'moderation.read', write: 'moderation.write' };
    case 'finance.cashouts_pending':
      return { read: 'finance.read', write: 'finance.write' };
    case 'integrations.webhooks_failed':
      return { read: 'integrations.read', write: 'integrations.write' };
    case 'ingestion.errors_24h':
    case 'ingestion.jobs_failed':
      return { read: 'ingestion.read', write: 'ingestion.write' };
    case 'risk.kyc_pending':
    case 'risk.flags_open':
      return { read: 'risk.read', write: 'risk.write' };
    default:
      return null;
  }
}

export function getAllowedTaskTypes(access: AdminAccess): AdminTaskType[] {
  if (access.allowAll) {
    return [
      'support.ticket',
      'crm.lead',
      'moderation.queue',
      'finance.cashouts_pending',
      'integrations.webhooks_failed',
      'ingestion.errors_24h',
      'ingestion.jobs_failed',
      'risk.kyc_pending',
      'risk.flags_open',
    ];
  }

  const allowed: AdminTaskType[] = [];
  const can = (permission: string) => access.permissions.has(permission);

  if (can('support.read')) allowed.push('support.ticket');
  if (can('crm.read')) allowed.push('crm.lead');
  if (can('moderation.read')) allowed.push('moderation.queue');
  if (can('finance.read')) allowed.push('finance.cashouts_pending');
  if (can('integrations.read')) allowed.push('integrations.webhooks_failed');
  if (can('ingestion.read')) allowed.push('ingestion.errors_24h', 'ingestion.jobs_failed');
  if (can('risk.read')) allowed.push('risk.kyc_pending', 'risk.flags_open');

  return allowed;
}

export type UiTaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export function toUiPriority(priority: string | null | undefined): UiTaskPriority {
  if (priority === 'critical') return 'urgent';
  if (priority === 'high') return 'high';
  if (priority === 'low') return 'low';
  return 'medium';
}

export function taskHref(taskType: string): string {
  switch (taskType) {
    case 'support.ticket':
      return '/app/admin/support';
    case 'crm.lead':
      return '/app/admin/crm';
    case 'moderation.queue':
      return '/app/admin/moderation';
    case 'finance.cashouts_pending':
      return '/app/admin/finance?status=requested';
    case 'integrations.webhooks_failed':
      return '/app/admin/integrations?delivery_status=failed';
    case 'ingestion.errors_24h':
    case 'ingestion.jobs_failed':
      return '/app/admin/ingestion';
    case 'risk.kyc_pending':
    case 'risk.flags_open':
      return '/app/admin/risk';
    default:
      return '/app/admin/inbox';
  }
}

