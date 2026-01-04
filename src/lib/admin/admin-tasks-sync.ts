import { getAdminClient } from '@/lib/admin/supabase';
import { createError } from '@/lib/errors';

type SupabaseErrorLike = { message?: string; code?: string } | null | undefined;

function isMissingTable(error: SupabaseErrorLike, tableName: string) {
  const code = String((error as any)?.code || '').toUpperCase();
  if (code === '42P01') return true;
  const msg = String((error as any)?.message || '').toLowerCase();
  if (!msg.includes(tableName.toLowerCase())) return false;
  return msg.includes('does not exist') || msg.includes('could not find') || msg.includes('schema cache');
}

function hoursBetween(fromIso: string | null) {
  if (!fromIso) return null;
  const t = new Date(fromIso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.round((Date.now() - t) / (60 * 60 * 1000)));
}

function priorityFromAgeHours(ageHours: number | null) {
  if (ageHours === null) return 'normal' as const;
  if (ageHours >= 72) return 'critical' as const;
  if (ageHours >= 24) return 'high' as const;
  if (ageHours >= 6) return 'normal' as const;
  return 'low' as const;
}

type TaskUpsert = {
  source_table: string;
  source_id: string;
  task_type: string;
  title: string;
  description?: string | null;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  status?: 'open' | 'in_progress' | 'blocked' | 'done' | 'canceled';
  assigned_to?: string | null;
  due_at?: string | null;
  metadata?: Record<string, unknown>;
  updated_at?: string;
};

const SYNC_TTL_MS = 15_000;
let lastSyncAtMs = 0;

export async function ensureAdminTasksSynced(opts?: { force?: boolean }) {
  const now = Date.now();
  if (!opts?.force && now - lastSyncAtMs < SYNC_TTL_MS) return { ok: true, skipped: true };
  lastSyncAtMs = now;

  const admin = getAdminClient();

  const existsRes = await admin.from('admin_tasks').select('id').limit(1);
  if (existsRes.error) {
    if (isMissingTable(existsRes.error, 'admin_tasks')) return { ok: true, skipped: true, missing: true };
    throw createError('DATABASE_ERROR', "Impossible d'accéder à admin_tasks", 500, existsRes.error.message);
  }

  const nowIso = new Date().toISOString();

  const upsertMany = async (tasks: TaskUpsert[]) => {
    if (tasks.length === 0) return;
    const payload = tasks.map((t) => ({
      ...t,
      metadata: t.metadata ?? {},
      updated_at: nowIso,
    }));
    const { error } = await admin
      .from('admin_tasks')
      .upsert(payload as any, { onConflict: 'source_table,source_id,task_type' });
    if (error) throw createError('DATABASE_ERROR', 'Failed to sync admin_tasks', 500, error.message);
  };

  // ---- Aggregated tasks (stable, low volume)
  const aggregated: TaskUpsert[] = [];

  // Cashouts pending
  {
    const { count, error } = await admin
      .from('cashouts')
      .select('id', { count: 'exact', head: true })
      .in('status', ['requested', 'processing']);
    if (!error) {
      const { data: oldest } = await admin
        .from('cashouts')
        .select('requested_at')
        .in('status', ['requested', 'processing'])
        .order('requested_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      const oldestAt = (oldest as any)?.requested_at ?? null;
      const ageHours = hoursBetween(oldestAt);
      aggregated.push({
        source_table: 'cashouts',
        source_id: 'pending',
        task_type: 'finance.cashouts_pending',
        title: 'Cashouts à traiter',
        description: count ? `${count} demande(s) en attente de validation.` : 'Aucune demande en attente.',
        status: count && count > 0 ? 'open' : 'done',
        priority: priorityFromAgeHours(ageHours),
        metadata: {
          count: count ?? 0,
          oldest_at: oldestAt,
          href: '/app/admin/finance?status=requested',
        },
      });
    }
  }

  // Webhooks failed (24h)
  {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error } = await admin
      .from('webhook_deliveries')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('created_at', since24h);
    if (!error) {
      const { data: oldest } = await admin
        .from('webhook_deliveries')
        .select('created_at')
        .eq('status', 'failed')
        .gte('created_at', since24h)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      const oldestAt = (oldest as any)?.created_at ?? null;
      const ageHours = hoursBetween(oldestAt);
      aggregated.push({
        source_table: 'webhook_deliveries',
        source_id: 'failed_24h',
        task_type: 'integrations.webhooks_failed',
        title: 'Webhooks en échec',
        description: count ? `${count} échec(s) sur les dernières 24h.` : 'Aucun échec sur 24h.',
        status: count && count > 0 ? 'open' : 'done',
        priority: priorityFromAgeHours(ageHours),
        metadata: {
          count: count ?? 0,
          oldest_at: oldestAt,
          href: '/app/admin/integrations?delivery_status=failed',
          playbook_key: 'webhooks.failed',
        },
      });
    }
  }

  // Ingestion errors (24h) + failed jobs (7d)
  {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error } = await admin
      .from('ingestion_errors')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since24h);
    if (!error) {
      aggregated.push({
        source_table: 'ingestion_errors',
        source_id: 'last_24h',
        task_type: 'ingestion.errors_24h',
        title: 'Erreurs ingestion',
        description: count ? `${count} erreur(s) sur les dernières 24h.` : 'Aucune erreur sur 24h.',
        status: count && count > 0 ? 'open' : 'done',
        priority: count && count >= 10 ? 'critical' : count && count >= 3 ? 'high' : 'normal',
        metadata: {
          count: count ?? 0,
          href: '/app/admin/ingestion',
        },
      });
    }

    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: jobsCount, error: jobsError } = await admin
      .from('ingestion_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('created_at', since7d);
    if (!jobsError) {
      aggregated.push({
        source_table: 'ingestion_jobs',
        source_id: 'failed_7d',
        task_type: 'ingestion.jobs_failed',
        title: 'Jobs ingestion en échec',
        description: jobsCount ? `${jobsCount} job(s) en échec sur 7 jours.` : 'Aucun job en échec sur 7 jours.',
        status: jobsCount && jobsCount > 0 ? 'open' : 'done',
        priority: jobsCount && jobsCount >= 10 ? 'high' : 'normal',
        metadata: {
          count: jobsCount ?? 0,
          href: '/app/admin/ingestion?job_status=failed',
        },
      });
    }
  }

  // Risk / KYC
  {
    const { count: kycCount, error: kycError } = await admin
      .from('kyc_checks')
      .select('user_id', { count: 'exact', head: true })
      .eq('status', 'pending');
    if (!kycError) {
      aggregated.push({
        source_table: 'kyc_checks',
        source_id: 'pending',
        task_type: 'risk.kyc_pending',
        title: 'KYC à vérifier',
        description: kycCount ? `${kycCount} contrôle(s) KYC en attente.` : 'Aucun KYC en attente.',
        status: kycCount && kycCount > 0 ? 'open' : 'done',
        priority: kycCount && kycCount >= 10 ? 'high' : 'normal',
        metadata: {
          count: kycCount ?? 0,
          href: '/app/admin/risk?kyc_status=pending',
        },
      });
    }

    const { count: flagsCount, error: flagsError } = await admin
      .from('risk_flags')
      .select('id', { count: 'exact', head: true })
      .is('resolved_at', null);
    if (!flagsError) {
      aggregated.push({
        source_table: 'risk_flags',
        source_id: 'open',
        task_type: 'risk.flags_open',
        title: 'Risk flags ouverts',
        description: flagsCount ? `${flagsCount} signal(aux) non résolu(s).` : 'Aucun signal ouvert.',
        status: flagsCount && flagsCount > 0 ? 'open' : 'done',
        priority: flagsCount && flagsCount >= 10 ? 'high' : 'normal',
        metadata: {
          count: flagsCount ?? 0,
          href: '/app/admin/risk?flag_resolved=false',
        },
      });
    }
  }

  await upsertMany(aggregated);

  // ---- Per-record tasks (assignable)
  const perRecord: TaskUpsert[] = [];

  // Support tickets (open/pending)
  {
    const { count, error: countErr } = await admin
      .from('support_tickets')
      .select('id', { count: 'exact', head: true })
      .in('status', ['open', 'pending']);
    if (!countErr && typeof count === 'number') {
      const cap = 200;
      const loadAll = count <= cap;
      const { data: rows, error } = await admin
        .from('support_tickets')
        .select('id, subject, status, priority, assigned_to, created_at')
        .in('status', ['open', 'pending'])
        .order('created_at', { ascending: true })
        .limit(loadAll ? cap : cap);
      if (!error) {
        for (const row of rows ?? []) {
          perRecord.push({
            source_table: 'support_tickets',
            source_id: String((row as any).id),
            task_type: 'support.ticket',
            title: 'Support',
            description: (row as any).subject ?? 'Ticket support',
            status: 'open',
            priority:
              (row as any).priority === 'urgent'
                ? 'critical'
                : (row as any).priority === 'high'
                  ? 'high'
                  : 'normal',
            assigned_to: (row as any).assigned_to ?? null,
            metadata: {
              count: 1,
              href: '/app/admin/support',
              source_status: (row as any).status,
            },
          });
        }

        if (loadAll) {
          const openIds = new Set((rows ?? []).map((r: any) => String(r.id)));
          const { data: existing } = await admin
            .from('admin_tasks')
            .select('id, source_id')
            .eq('source_table', 'support_tickets')
            .eq('task_type', 'support.ticket')
            .in('status', ['open', 'in_progress', 'blocked'])
            .limit(500);
          const toClose = (existing ?? []).filter((t: any) => !openIds.has(String(t.source_id))).map((t: any) => t.id);
          if (toClose.length) {
            const { error: closeErr } = await admin
              .from('admin_tasks')
              .update({ status: 'done', updated_at: nowIso })
              .in('id', toClose);
            if (closeErr) throw createError('DATABASE_ERROR', 'Failed to close resolved support tasks', 500, closeErr.message);
          }
        }
      }
    }
  }

  // CRM leads (new/contacted)
  {
    const { count, error: countErr } = await admin
      .from('sales_leads')
      .select('id', { count: 'exact', head: true })
      .in('status', ['new', 'contacted']);
    if (!countErr && typeof count === 'number') {
      const cap = 200;
      const loadAll = count <= cap;
      const { data: rows, error } = await admin
        .from('sales_leads')
        .select('id, name, company, status, assigned_to, created_at')
        .in('status', ['new', 'contacted'])
        .order('created_at', { ascending: true })
        .limit(loadAll ? cap : cap);
      if (!error) {
        for (const row of rows ?? []) {
          const name = (row as any).name ?? 'Lead';
          const company = (row as any).company ?? null;
          perRecord.push({
            source_table: 'sales_leads',
            source_id: String((row as any).id),
            task_type: 'crm.lead',
            title: 'CRM',
            description: company ? `${name} · ${company}` : name,
            status: 'open',
            priority: 'normal',
            assigned_to: (row as any).assigned_to ?? null,
            metadata: {
              count: 1,
              href: '/app/admin/crm',
              source_status: (row as any).status,
            },
          });
        }

        if (loadAll) {
          const openIds = new Set((rows ?? []).map((r: any) => String(r.id)));
          const { data: existing } = await admin
            .from('admin_tasks')
            .select('id, source_id')
            .eq('source_table', 'sales_leads')
            .eq('task_type', 'crm.lead')
            .in('status', ['open', 'in_progress', 'blocked'])
            .limit(500);
          const toClose = (existing ?? []).filter((t: any) => !openIds.has(String(t.source_id))).map((t: any) => t.id);
          if (toClose.length) {
            const { error: closeErr } = await admin
              .from('admin_tasks')
              .update({ status: 'done', updated_at: nowIso })
              .in('id', toClose);
            if (closeErr) throw createError('DATABASE_ERROR', 'Failed to close resolved lead tasks', 500, closeErr.message);
          }
        }
      }
    }
  }

  // Moderation queue (pending/processing)
  {
    const { count, error: countErr } = await admin
      .from('moderation_queue')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'processing']);
    if (!countErr && typeof count === 'number') {
      const cap = 250;
      const loadAll = count <= cap;
      const { data: rows, error } = await admin
        .from('moderation_queue')
        .select('id, status, created_at, reviewed_by')
        .in('status', ['pending', 'processing'])
        .order('created_at', { ascending: true })
        .limit(loadAll ? cap : cap);
      if (!error) {
        for (const row of rows ?? []) {
          const status = (row as any).status;
          perRecord.push({
            source_table: 'moderation_queue',
            source_id: String((row as any).id),
            task_type: 'moderation.queue',
            title: 'Modération',
            description: status === 'processing' ? 'En cours de traitement' : 'À modérer',
            status: status === 'processing' ? 'in_progress' : 'open',
            priority: 'high',
            assigned_to: (row as any).reviewed_by ?? null,
            metadata: {
              count: 1,
              href: '/app/admin/moderation',
              source_status: status,
            },
          });
        }

        if (loadAll) {
          const openIds = new Set((rows ?? []).map((r: any) => String(r.id)));
          const { data: existing } = await admin
            .from('admin_tasks')
            .select('id, source_id')
            .eq('source_table', 'moderation_queue')
            .eq('task_type', 'moderation.queue')
            .in('status', ['open', 'in_progress', 'blocked'])
            .limit(1000);
          const toClose = (existing ?? []).filter((t: any) => !openIds.has(String(t.source_id))).map((t: any) => t.id);
          if (toClose.length) {
            const { error: closeErr } = await admin
              .from('admin_tasks')
              .update({ status: 'done', updated_at: nowIso })
              .in('id', toClose);
            if (closeErr) throw createError('DATABASE_ERROR', 'Failed to close resolved moderation tasks', 500, closeErr.message);
          }
        }
      }
    }
  }

  await upsertMany(perRecord);

  return { ok: true, skipped: false };
}
