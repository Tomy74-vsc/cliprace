import { NextResponse } from 'next/server';

import { requireAdminPermission, hasAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { ensureAdminTasksSynced } from '@/lib/admin/admin-tasks-sync';
import { adminCache, cacheKey } from '@/lib/admin/cache';
import { createError, formatErrorResponse } from '@/lib/errors';
import { getAllowedTaskTypes } from '@/lib/admin/admin-tasks';

type SupabaseErrorLike = { message?: string; code?: string } | null | undefined;

function isMissingTable(error: SupabaseErrorLike, tableName: string) {
  const code = String((error as UnsafeAny)?.code || '').toUpperCase();
  if (code === '42P01') return true;
  const msg = String((error as UnsafeAny)?.message || '').toLowerCase();
  if (!msg.includes(tableName.toLowerCase())) return false;
  return msg.includes('does not exist') || msg.includes('could not find') || msg.includes('schema cache');
}

function isoHoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

async function countExact(table: string, filter: (q: UnsafeAny) => UnsafeAny) {
  const admin = getAdminClient();
  const { count, error } = await filter(admin.from(table).select('id', { count: 'exact', head: true }));
  if (error) throw createError('DATABASE_ERROR', `Failed to count ${table}`, 500, error.message);
  return count ?? 0;
}

async function oldestIso(table: string, select: string, filter: (q: UnsafeAny) => UnsafeAny, orderBy: string) {
  const admin = getAdminClient();
  const { data, error } = await filter(admin.from(table).select(select).order(orderBy, { ascending: true }).limit(1)).maybeSingle();
  if (error) throw createError('DATABASE_ERROR', `Failed to load ${table}`, 500, error.message);
  const row = data as UnsafeAny;
  const value = row?.[orderBy];
  return typeof value === 'string' ? value : null;
}

async function legacySummary(access: Awaited<ReturnType<typeof requireAdminPermission>>['access']) {
  const can = (permission: string) => hasAdminPermission(access, permission);

  const since1h = isoHoursAgo(1);
  const since24h = isoHoursAgo(24);
  const since7d = isoHoursAgo(24 * 7);

  const ops = {
    cashouts_pending: 0,
    cashouts_oldest_at: null as string | null,
    moderation_pending: 0,
    moderation_oldest_at: null as string | null,
    webhook_failures_24h: 0,
    webhook_failures_1h: 0,
    ingestion_errors_24h: 0,
    ingestion_errors_1h: 0,
    ingestion_jobs_failed: 0,
    kyc_pending: 0,
    risk_flags_open: 0,
    support_open: 0,
    support_unassigned: 0,
    leads_new: 0,
    leads_unassigned: 0,
  };

  if (can('finance.read')) {
    ops.cashouts_pending = await countExact('cashouts', (q) => q.in('status', ['requested', 'processing']));
    ops.cashouts_oldest_at = await oldestIso(
      'cashouts',
      'requested_at',
      (q) => q.in('status', ['requested', 'processing']),
      'requested_at'
    );
  }

  if (can('moderation.read')) {
    ops.moderation_pending = await countExact('moderation_queue', (q) => q.in('status', ['pending', 'processing']));
    ops.moderation_oldest_at = await oldestIso(
      'moderation_queue',
      'created_at',
      (q) => q.in('status', ['pending', 'processing']),
      'created_at'
    );
  }

  if (can('integrations.read')) {
    ops.webhook_failures_24h = await countExact('webhook_deliveries', (q) => q.eq('status', 'failed').gte('created_at', since24h));
    ops.webhook_failures_1h = await countExact('webhook_deliveries', (q) => q.eq('status', 'failed').gte('created_at', since1h));
  }

  if (can('ingestion.read')) {
    ops.ingestion_errors_24h = await countExact('ingestion_errors', (q) => q.gte('created_at', since24h));
    ops.ingestion_errors_1h = await countExact('ingestion_errors', (q) => q.gte('created_at', since1h));
    ops.ingestion_jobs_failed = await countExact('ingestion_jobs', (q) => q.eq('status', 'failed').gte('created_at', since7d));
  }

  if (can('risk.read')) {
    ops.kyc_pending = await countExact('kyc_checks', (q) => q.eq('status', 'pending'));
    ops.risk_flags_open = await countExact('risk_flags', (q) => q.is('resolved_at', null));
  }

  if (can('support.read')) {
    ops.support_open = await countExact('support_tickets', (q) => q.in('status', ['open', 'pending']));
    ops.support_unassigned = await countExact('support_tickets', (q) => q.in('status', ['open', 'pending']).is('assigned_to', null));
  }

  if (can('crm.read')) {
    ops.leads_new = await countExact('sales_leads', (q) => q.in('status', ['new', 'contacted']));
    ops.leads_unassigned = await countExact('sales_leads', (q) => q.in('status', ['new', 'contacted']).is('assigned_to', null));
  }

  const totalOps =
    ops.cashouts_pending +
    ops.moderation_pending +
    ops.webhook_failures_24h +
    ops.ingestion_errors_24h +
    ops.ingestion_jobs_failed +
    ops.kyc_pending +
    ops.risk_flags_open +
    ops.support_open +
    ops.leads_new;

  const signals: Array<{
    key: string;
    severity: 'info' | 'warning' | 'danger';
    title: string;
    message: string;
    href: string;
    count?: number;
  }> = [];

  if (ops.webhook_failures_1h >= 10) {
    signals.push({
      key: 'signals.webhooks_spike',
      severity: 'danger',
      title: 'Spike webhooks en échec',
      message: `${ops.webhook_failures_1h} échec(s) sur la dernière heure.`,
      href: '/app/admin/integrations?delivery_status=failed',
      count: ops.webhook_failures_1h,
    });
  } else if (ops.webhook_failures_24h >= 1) {
    signals.push({
      key: 'signals.webhooks_failed',
      severity: 'warning',
      title: 'Webhooks en échec',
      message: `${ops.webhook_failures_24h} échec(s) sur 24h.`,
      href: '/app/admin/integrations?delivery_status=failed',
      count: ops.webhook_failures_24h,
    });
  }

  if (ops.ingestion_errors_1h >= 10) {
    signals.push({
      key: 'signals.ingestion_spike',
      severity: 'danger',
      title: 'Spike erreurs ingestion',
      message: `${ops.ingestion_errors_1h} erreur(s) sur la dernière heure.`,
      href: '/app/admin/ingestion',
      count: ops.ingestion_errors_1h,
    });
  } else if (ops.ingestion_errors_24h >= 1) {
    signals.push({
      key: 'signals.ingestion_errors',
      severity: 'warning',
      title: 'Erreurs ingestion',
      message: `${ops.ingestion_errors_24h} erreur(s) sur 24h.`,
      href: '/app/admin/ingestion',
      count: ops.ingestion_errors_24h,
    });
  }

  if (can('risk.read') && ops.risk_flags_open >= 5) {
    signals.push({
      key: 'signals.risk_open',
      severity: 'warning',
      title: 'Signaux risque ouverts',
      message: `${ops.risk_flags_open} signal(aux) de risque non résolu(s).`,
      href: '/app/admin/risk?flag_resolved=false',
      count: ops.risk_flags_open,
    });
  }

  const totalSignals = signals.length;
  const badgeCount = Math.min(99, totalOps + totalSignals);

  return {
    generated_at: new Date().toISOString(),
    badge_count: badgeCount,
    ops: { ...ops, total: totalOps },
    signals: { total: totalSignals, items: signals },
  };
}

export async function GET() {
  try {
    const { access, user } = await requireAdminPermission('inbox.read');
    const can = (permission: string) => hasAdminPermission(access, permission);

    const key = cacheKey('admin:inbox:summary', { user_id: user.id });
    const payload = await adminCache.getOrSet(
      key,
      async () => {
        const syncRes = await ensureAdminTasksSynced();

        const admin = getAdminClient();
        const allowedTypes = getAllowedTaskTypes(access);

        const ops = {
          cashouts_pending: 0,
          cashouts_oldest_at: null as string | null,
          moderation_pending: 0,
          moderation_oldest_at: null as string | null,
          webhook_failures_24h: 0,
          webhook_failures_1h: 0,
          ingestion_errors_24h: 0,
          ingestion_errors_1h: 0,
          ingestion_jobs_failed: 0,
          kyc_pending: 0,
          risk_flags_open: 0,
          support_open: 0,
          support_unassigned: 0,
          leads_new: 0,
          leads_unassigned: 0,
        };

        if (syncRes && (syncRes as UnsafeAny).missing) {
          return await legacySummary(access);
        }

        const tasksRes = allowedTypes.length
          ? await admin
              .from('admin_tasks')
              .select('task_type, status, assigned_to, metadata, created_at')
              .in('task_type', allowedTypes as UnsafeAny)
          : { data: [], error: null as UnsafeAny };

        if (tasksRes.error) {
          if (isMissingTable(tasksRes.error, 'admin_tasks')) {
            return await legacySummary(access);
          }
          throw createError('DATABASE_ERROR', 'Failed to load admin_tasks summary', 500, tasksRes.error.message);
        }

        const rows = (tasksRes.data ?? []) as UnsafeAny[];
        const openRows = rows.filter((r) => ['open', 'in_progress', 'blocked'].includes(String(r.status)));

    const countByType = new Map<string, number>();
    const oldestByType = new Map<string, string>();
    for (const r of openRows) {
      const meta = (r.metadata ?? {}) as UnsafeAny;
      const count = typeof meta.count === 'number' ? meta.count : 1;
      countByType.set(r.task_type, (countByType.get(r.task_type) ?? 0) + count);
      const createdAt = typeof meta.oldest_at === 'string' ? meta.oldest_at : (r.created_at as string | undefined);
      if (createdAt) {
        const cur = oldestByType.get(r.task_type);
        if (!cur || new Date(createdAt).getTime() < new Date(cur).getTime()) oldestByType.set(r.task_type, createdAt);
      }
    }

    ops.cashouts_pending = can('finance.read') ? (countByType.get('finance.cashouts_pending') ?? 0) : 0;
    ops.cashouts_oldest_at = can('finance.read') ? (oldestByType.get('finance.cashouts_pending') ?? null) : null;

    ops.moderation_pending = can('moderation.read') ? (countByType.get('moderation.queue') ?? 0) : 0;
    ops.moderation_oldest_at = can('moderation.read') ? (oldestByType.get('moderation.queue') ?? null) : null;

    ops.webhook_failures_24h = can('integrations.read') ? (countByType.get('integrations.webhooks_failed') ?? 0) : 0;

    ops.ingestion_errors_24h = can('ingestion.read') ? (countByType.get('ingestion.errors_24h') ?? 0) : 0;
    ops.ingestion_jobs_failed = can('ingestion.read') ? (countByType.get('ingestion.jobs_failed') ?? 0) : 0;

    ops.kyc_pending = can('risk.read') ? (countByType.get('risk.kyc_pending') ?? 0) : 0;
    ops.risk_flags_open = can('risk.read') ? (countByType.get('risk.flags_open') ?? 0) : 0;

    ops.support_open = can('support.read') ? (countByType.get('support.ticket') ?? 0) : 0;
    ops.support_unassigned = can('support.read')
      ? openRows.filter((r) => r.task_type === 'support.ticket' && !r.assigned_to).length
      : 0;

    ops.leads_new = can('crm.read') ? (countByType.get('crm.lead') ?? 0) : 0;
    ops.leads_unassigned = can('crm.read')
      ? openRows.filter((r) => r.task_type === 'crm.lead' && !r.assigned_to).length
      : 0;

    // Signals still come from live tables (spikes)
    const since1h = isoHoursAgo(1);
    const since24h = isoHoursAgo(24);
    ops.webhook_failures_1h = can('integrations.read')
      ? await countExact('webhook_deliveries', (q) => q.eq('status', 'failed').gte('created_at', since1h))
      : 0;
    ops.ingestion_errors_1h = can('ingestion.read')
      ? await countExact('ingestion_errors', (q) => q.gte('created_at', since1h))
      : 0;
    if (can('integrations.read') && ops.webhook_failures_24h === 0) {
      // Keep the 24h count aligned even if tasks are missing/late for a moment.
      ops.webhook_failures_24h = await countExact('webhook_deliveries', (q) => q.eq('status', 'failed').gte('created_at', since24h));
    }
    if (can('ingestion.read') && ops.ingestion_errors_24h === 0) {
      ops.ingestion_errors_24h = await countExact('ingestion_errors', (q) => q.gte('created_at', since24h));
    }

    const totalOps =
      ops.cashouts_pending +
      ops.moderation_pending +
      ops.webhook_failures_24h +
      ops.ingestion_errors_24h +
      ops.ingestion_jobs_failed +
      ops.kyc_pending +
      ops.risk_flags_open +
      ops.support_open +
      ops.leads_new;

    const signals: Array<{
      key: string;
      severity: 'info' | 'warning' | 'danger';
      title: string;
      message: string;
      href: string;
      count?: number;
    }> = [];

    if (ops.webhook_failures_1h >= 10) {
      signals.push({
        key: 'signals.webhooks_spike',
        severity: 'danger',
        title: 'Spike webhooks en échec',
        message: `${ops.webhook_failures_1h} échec(s) sur la dernière heure.`,
        href: '/app/admin/integrations?delivery_status=failed',
        count: ops.webhook_failures_1h,
      });
    } else if (ops.webhook_failures_24h >= 1) {
      signals.push({
        key: 'signals.webhooks_failed',
        severity: 'warning',
        title: 'Webhooks en échec',
        message: `${ops.webhook_failures_24h} échec(s) sur 24h.`,
        href: '/app/admin/integrations?delivery_status=failed',
        count: ops.webhook_failures_24h,
      });
    }

    if (ops.ingestion_errors_1h >= 10) {
      signals.push({
        key: 'signals.ingestion_spike',
        severity: 'danger',
        title: 'Spike erreurs ingestion',
        message: `${ops.ingestion_errors_1h} erreur(s) sur la dernière heure.`,
        href: '/app/admin/ingestion',
        count: ops.ingestion_errors_1h,
      });
    } else if (ops.ingestion_errors_24h >= 1) {
      signals.push({
        key: 'signals.ingestion_errors',
        severity: 'warning',
        title: 'Erreurs ingestion',
        message: `${ops.ingestion_errors_24h} erreur(s) sur 24h.`,
        href: '/app/admin/ingestion',
        count: ops.ingestion_errors_24h,
      });
    }

    if (can('risk.read') && ops.risk_flags_open >= 5) {
      signals.push({
        key: 'signals.risk_open',
        severity: 'warning',
        title: 'Signaux risque ouverts',
        message: `${ops.risk_flags_open} signal(aux) de risque non résolu(s).`,
        href: '/app/admin/risk?flag_resolved=false',
        count: ops.risk_flags_open,
      });
    }

    const totalSignals = signals.length;
    const badgeCount = Math.min(99, totalOps + totalSignals);

        return {
          generated_at: new Date().toISOString(),
          badge_count: badgeCount,
          ops: { ...ops, total: totalOps },
          signals: { total: totalSignals, items: signals },
        };
      },
      // TTL très court: évite les doublons (layout + client) sans cacher trop longtemps
      5_000
    );

    return NextResponse.json(payload);
  } catch (error) {
    return formatErrorResponse(error);
  }
}


