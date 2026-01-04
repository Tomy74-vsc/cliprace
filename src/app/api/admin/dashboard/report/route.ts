import { NextResponse } from 'next/server';
import { requireAdminPermission, hasAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { createError, formatErrorResponse } from '@/lib/errors';
import { ensureAdminTasksSynced } from '@/lib/admin/admin-tasks-sync';
import { getAllowedTaskTypes, getTaskPermission, taskHref, toUiPriority } from '@/lib/admin/admin-tasks';

function toDateStringUTC(date: Date) {
  return date.toISOString().slice(0, 10);
}

type SupabaseErrorLike = { message?: string; code?: string } | null | undefined;

function isMissingTable(error: SupabaseErrorLike, tableName: string) {
  const code = String((error as any)?.code || '').toUpperCase();
  if (code === '42P01') return true;
  const msg = String((error as any)?.message || '').toLowerCase();
  if (!msg.includes(tableName.toLowerCase())) return false;
  return msg.includes('does not exist') || msg.includes('could not find') || msg.includes('schema cache');
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}

function endOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

function safePercent(current: number, previous: number) {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function withDelta(current: number, prevDay: number, prevWeek: number) {
  return {
    value: current,
    delta_day: current - prevDay,
    delta_day_pct: safePercent(current, prevDay),
    delta_week: current - prevWeek,
    delta_week_pct: safePercent(current, prevWeek),
  };
}

function diffMs(aIso: string | null, bIso: string | null) {
  if (!aIso || !bIso) return null;
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return b - a;
}

function avg(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

export async function GET() {
  try {
    const { user, access } = await requireAdminPermission('dashboard.read');
    const can = (permission: string) => hasAdminPermission(access, permission);
    const admin = getAdminClient();

    const now = new Date();
    const today = startOfUtcDay(now);
    const yesterday = new Date(today);
    yesterday.setUTCDate(today.getUTCDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setUTCDate(today.getUTCDate() - 7);

    const todayDate = toDateStringUTC(today);
    const yesterdayDate = toDateStringUTC(yesterday);
    const weekAgoDate = toDateStringUTC(weekAgo);

    const todayStartIso = today.toISOString();
    const todayEndIso = endOfUtcDay(today).toISOString();
    const yesterdayStartIso = startOfUtcDay(yesterday).toISOString();
    const yesterdayEndIso = endOfUtcDay(yesterday).toISOString();
    const weekAgoStartIso = startOfUtcDay(weekAgo).toISOString();
    const weekAgoEndIso = endOfUtcDay(weekAgo).toISOString();
    const since7dIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const since24hIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const since1hIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    // ---- Today metrics (with D-1 / W-1 deltas)
    const metricsRes = await admin
      .from('metrics_daily')
      .select('metric_date, views, likes, comments, shares')
      .in('metric_date', [todayDate, yesterdayDate, weekAgoDate]);

    if (metricsRes.error) {
      throw createError('DATABASE_ERROR', 'Failed to load metrics', 500, metricsRes.error.message);
    }

    const dayAgg = new Map<string, { views: number; engagement: number }>();
    for (const row of metricsRes.data ?? []) {
      const key = row.metric_date as unknown as string;
      const cur = dayAgg.get(key) ?? { views: 0, engagement: 0 };
      cur.views += row.views ?? 0;
      cur.engagement += (row.likes ?? 0) + (row.comments ?? 0) + (row.shares ?? 0);
      dayAgg.set(key, cur);
    }

    const viewsToday = dayAgg.get(todayDate)?.views ?? 0;
    const viewsYesterday = dayAgg.get(yesterdayDate)?.views ?? 0;
    const viewsWeekAgo = dayAgg.get(weekAgoDate)?.views ?? 0;

    const engagementToday = dayAgg.get(todayDate)?.engagement ?? 0;
    const engagementYesterday = dayAgg.get(yesterdayDate)?.engagement ?? 0;
    const engagementWeekAgo = dayAgg.get(weekAgoDate)?.engagement ?? 0;

    const { count: usersToday, error: usersTodayErr } = await admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', todayStartIso)
      .lte('created_at', todayEndIso);
    if (usersTodayErr) throw createError('DATABASE_ERROR', 'Failed to load users', 500, usersTodayErr.message);

    const { count: usersYesterday, error: usersYesterdayErr } = await admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', yesterdayStartIso)
      .lte('created_at', yesterdayEndIso);
    if (usersYesterdayErr) throw createError('DATABASE_ERROR', 'Failed to load users', 500, usersYesterdayErr.message);

    const { count: usersWeekAgo, error: usersWeekAgoErr } = await admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', weekAgoStartIso)
      .lte('created_at', weekAgoEndIso);
    if (usersWeekAgoErr) throw createError('DATABASE_ERROR', 'Failed to load users', 500, usersWeekAgoErr.message);

    const paymentsRes = await admin
      .from('payments_brand')
      .select('amount_cents, status, created_at')
      .gte('created_at', weekAgoStartIso)
      .lte('created_at', todayEndIso);
    if (paymentsRes.error) throw createError('DATABASE_ERROR', 'Failed to load payments', 500, paymentsRes.error.message);

    const payDay = new Map<string, number>();
    for (const p of paymentsRes.data ?? []) {
      if (p.status !== 'succeeded') continue;
      const d = toDateStringUTC(new Date(p.created_at as any));
      payDay.set(d, (payDay.get(d) ?? 0) + (p.amount_cents ?? 0));
    }
    const revenueToday = payDay.get(todayDate) ?? 0;
    const revenueYesterday = payDay.get(yesterdayDate) ?? 0;
    const revenueWeekAgo = payDay.get(weekAgoDate) ?? 0;

    const { count: pendingSubmissions, error: pendingSubErr } = await admin
      .from('submissions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');
    if (pendingSubErr) throw createError('DATABASE_ERROR', 'Failed to load submissions', 500, pendingSubErr.message);

    const { count: cashoutsPending, error: cashoutsErr } = can('finance.read')
      ? await admin
          .from('cashouts')
          .select('id', { count: 'exact', head: true })
          .in('status', ['requested', 'processing'])
      : { count: 0, error: null };
    if (cashoutsErr) throw createError('DATABASE_ERROR', 'Failed to load cashouts', 500, cashoutsErr.message);

    const { count: supportOpen, error: supportErr } = can('support.read')
      ? await admin
          .from('support_tickets')
          .select('id', { count: 'exact', head: true })
          .in('status', ['open', 'pending'])
      : { count: 0, error: null };
    if (supportErr) throw createError('DATABASE_ERROR', 'Failed to load support', 500, supportErr.message);

    // ---- Top 10 actionable tasks
    const tasks: Array<any> = [];
    const myWork: any = {
      moderation_claimed: 0,
      support_assigned_to_me: 0,
      leads_assigned_to_me: 0,
      moderation_unassigned: 0,
      support_unassigned: 0,
      leads_unassigned: 0,
    };

    if (false) {
    if (can('moderation.read')) {
      const [{ count: mineCount, error: mineErr }, { count: unassignedCount, error: unassignedErr }] = await Promise.all([
        admin
          .from('moderation_queue')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'processing')
          .eq('reviewed_by', user.id),
        admin
          .from('moderation_queue')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending')
          .is('reviewed_by', null),
      ]);
      if (mineErr) throw createError('DATABASE_ERROR', 'Failed to load moderation stats', 500, mineErr?.message);
      if (unassignedErr) throw createError('DATABASE_ERROR', 'Failed to load moderation stats', 500, unassignedErr?.message);
      myWork.moderation_claimed = mineCount ?? 0;
      myWork.moderation_unassigned = unassignedCount ?? 0;

      const [{ data: pendingRows, error: pendingErr }, { data: mineRows, error: mineRowsErr }] = await Promise.all([
        admin
          .from('moderation_queue')
          .select(
            'id, status, created_at, reviewed_by, submission:submissions(id, contest_id, creator_id, title, thumbnail_url, external_url, contest:contests(id, title), creator:profiles(id, display_name, email))'
          )
          .eq('status', 'pending')
          .is('reviewed_by', null)
          .order('created_at', { ascending: true })
          .limit(3),
        admin
          .from('moderation_queue')
          .select(
            'id, status, created_at, reviewed_by, submission:submissions(id, contest_id, creator_id, title, thumbnail_url, external_url, contest:contests(id, title), creator:profiles(id, display_name, email))'
          )
          .eq('status', 'processing')
          .eq('reviewed_by', user.id)
          .order('created_at', { ascending: true })
          .limit(2),
      ]);
      if (pendingErr) throw createError('DATABASE_ERROR', 'Failed to load moderation tasks', 500, pendingErr?.message);
      if (mineRowsErr) throw createError('DATABASE_ERROR', 'Failed to load moderation tasks', 500, mineRowsErr?.message);

      const rows = [...(mineRows ?? []), ...(pendingRows ?? [])];
      for (const row of rows) {
        const submission: any = (row as any).submission;
        const creator = submission?.creator ?? null;
        const contest = submission?.contest ?? null;
        const isMine = (row as any).reviewed_by && (row as any).reviewed_by === user.id;
        const canClaim = can('moderation.write');
        tasks.push({
          type: 'moderation.queue',
          id: (row as any).id,
          priority: 'high',
          title: 'Modération',
          subtitle: contest?.title ? `Concours : ${contest.title}` : 'Concours inconnu',
          meta: creator ? `Créateur : ${creator.display_name || creator.email}` : 'Créateur inconnu',
          created_at: (row as any).created_at,
          owner: (row as any).reviewed_by ?? null,
          owner_is_me: isMine,
          cta: canClaim
            ? { kind: 'claim', label: isMine ? 'Assigné à moi' : 'Assigner à moi', href: '/app/admin/moderation' }
            : { kind: 'open', label: 'Voir', href: '/app/admin/moderation' },
          href: '/app/admin/moderation',
        });
      }
    }

    if (can('support.read')) {
      const [{ count: assignedToMe, error: assignedErr }, { count: unassigned, error: unassignedErr }] = await Promise.all([
        admin
          .from('support_tickets')
          .select('id', { count: 'exact', head: true })
          .in('status', ['open', 'pending'])
          .eq('assigned_to', user.id),
        admin
          .from('support_tickets')
          .select('id', { count: 'exact', head: true })
          .in('status', ['open', 'pending'])
          .is('assigned_to', null),
      ]);
      if (assignedErr) throw createError('DATABASE_ERROR', 'Failed to load support stats', 500, assignedErr?.message);
      if (unassignedErr) throw createError('DATABASE_ERROR', 'Failed to load support stats', 500, unassignedErr?.message);
      myWork.support_assigned_to_me = assignedToMe ?? 0;
      myWork.support_unassigned = unassigned ?? 0;

      const [{ data: unassignedRows, error: unassignedRowsErr }, { data: mineRows, error: mineRowsErr }] =
        await Promise.all([
          admin
            .from('support_tickets')
            .select('id, subject, status, priority, assigned_to, created_at, requester:profiles(id, display_name, email)')
            .in('status', ['open', 'pending'])
            .is('assigned_to', null)
            .order('created_at', { ascending: true })
            .limit(2),
          admin
            .from('support_tickets')
            .select('id, subject, status, priority, assigned_to, created_at, requester:profiles(id, display_name, email)')
            .in('status', ['open', 'pending'])
            .eq('assigned_to', user.id)
            .order('created_at', { ascending: true })
            .limit(2),
        ]);
      if (unassignedRowsErr) throw createError('DATABASE_ERROR', 'Failed to load support tasks', 500, unassignedRowsErr?.message);
      if (mineRowsErr) throw createError('DATABASE_ERROR', 'Failed to load support tasks', 500, mineRowsErr?.message);

      const rows = [...(mineRows ?? []), ...(unassignedRows ?? [])];
      for (const row of rows) {
        const requester = (row as any).requester;
        const isMine = row.assigned_to && row.assigned_to === user.id;
        const isUnassigned = !row.assigned_to;
        const canWrite = can('support.write');
        tasks.push({
          type: 'support.ticket',
          id: row.id,
          priority: row.priority === 'urgent' ? 'urgent' : row.priority === 'high' ? 'high' : 'medium',
          title: 'Support',
          subtitle: row.subject,
          meta: requester ? `${requester.display_name || requester.email}` : row.id,
          created_at: row.created_at,
          owner: row.assigned_to ?? null,
          owner_is_me: Boolean(isMine),
          cta: isUnassigned && canWrite
            ? { kind: 'assign_to_me', label: 'Assigner à moi', href: '/app/admin/support' }
            : { kind: 'open', label: 'Ouvrir', href: '/app/admin/support' },
          href: '/app/admin/support',
        });
      }
    }

    if (can('crm.read')) {
      const [{ count: assignedToMe, error: assignedErr }, { count: unassigned, error: unassignedErr }] = await Promise.all([
        admin
          .from('sales_leads')
          .select('id', { count: 'exact', head: true })
          .in('status', ['new', 'contacted'])
          .eq('assigned_to', user.id),
        admin
          .from('sales_leads')
          .select('id', { count: 'exact', head: true })
          .in('status', ['new', 'contacted'])
          .is('assigned_to', null),
      ]);
      if (assignedErr) throw createError('DATABASE_ERROR', 'Failed to load leads stats', 500, assignedErr?.message);
      if (unassignedErr) throw createError('DATABASE_ERROR', 'Failed to load leads stats', 500, unassignedErr?.message);
      myWork.leads_assigned_to_me = assignedToMe ?? 0;
      myWork.leads_unassigned = unassigned ?? 0;

      const [{ data: unassignedRows, error: unassignedRowsErr }, { data: mineRows, error: mineRowsErr }] =
        await Promise.all([
          admin
            .from('sales_leads')
            .select('id, name, company, status, assigned_to, created_at')
            .in('status', ['new', 'contacted'])
            .is('assigned_to', null)
            .order('created_at', { ascending: true })
            .limit(2),
          admin
            .from('sales_leads')
            .select('id, name, company, status, assigned_to, created_at')
            .in('status', ['new', 'contacted'])
            .eq('assigned_to', user.id)
            .order('created_at', { ascending: true })
            .limit(2),
        ]);
      if (unassignedRowsErr) throw createError('DATABASE_ERROR', 'Failed to load leads tasks', 500, unassignedRowsErr?.message);
      if (mineRowsErr) throw createError('DATABASE_ERROR', 'Failed to load leads tasks', 500, mineRowsErr?.message);

      const rows = [...(mineRows ?? []), ...(unassignedRows ?? [])];
      for (const row of rows) {
        const isMine = row.assigned_to && row.assigned_to === user.id;
        const isUnassigned = !row.assigned_to;
        const canWrite = can('crm.write');
        tasks.push({
          type: 'crm.lead',
          id: row.id,
          priority: row.status === 'new' ? 'high' : 'medium',
          title: 'CRM',
          subtitle: row.name,
          meta: row.company ? `Société : ${row.company}` : '—',
          created_at: row.created_at,
          owner: row.assigned_to ?? null,
          owner_is_me: Boolean(isMine),
          cta: isUnassigned && canWrite
            ? { kind: 'assign_to_me', label: 'Assigner à moi', href: '/app/admin/crm' }
            : { kind: 'open', label: 'Ouvrir', href: '/app/admin/crm' },
          href: '/app/admin/crm',
        });
      }
    }

    // Enrich with high-level ops tasks (non-assignable)
    if (can('integrations.read')) {
      const { count, error } = await admin
        .from('webhook_deliveries')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'failed')
        .gte('created_at', since24hIso);
      if (error) throw createError('DATABASE_ERROR', 'Failed to load webhooks', 500, error?.message);
      if ((count ?? 0) > 0) {
        tasks.push({
          type: 'integrations.webhooks',
          id: null,
          priority: (count ?? 0) >= 10 ? 'high' : 'medium',
          title: 'Webhooks',
          subtitle: 'Deliveries en échec (24h)',
          meta: `${count ?? 0} échec(s)`,
          created_at: null,
          owner: null,
          owner_is_me: false,
          cta: { kind: 'open', label: 'Voir', href: '/app/admin/integrations?delivery_status=failed' },
          href: '/app/admin/integrations?delivery_status=failed',
        });
      }
    }
    }

    await ensureAdminTasksSynced();
    const openStatuses = ['open', 'in_progress', 'blocked'];
    const allowedTypes = getAllowedTaskTypes(access);

    if (allowedTypes.length > 0) {
      const [
        { data: taskRows, error: tasksErr },
        moderationMine,
        moderationUnassigned,
        supportMine,
        supportUnassigned,
        leadsMine,
        leadsUnassigned,
      ] = await Promise.all([
        admin
          .from('admin_tasks')
          .select('id, task_type, title, description, priority, status, assigned_to, metadata, created_at')
          .in('task_type', allowedTypes as any)
          .in('status', openStatuses)
          .limit(60),
        can('moderation.read')
          ? admin
              .from('admin_tasks')
              .select('id', { count: 'exact', head: true })
              .eq('task_type', 'moderation.queue')
              .in('status', openStatuses)
              .eq('assigned_to', user.id)
          : Promise.resolve({ count: 0, error: null } as any),
        can('moderation.read')
          ? admin
              .from('admin_tasks')
              .select('id', { count: 'exact', head: true })
              .eq('task_type', 'moderation.queue')
              .in('status', openStatuses)
              .is('assigned_to', null)
          : Promise.resolve({ count: 0, error: null } as any),
        can('support.read')
          ? admin
              .from('admin_tasks')
              .select('id', { count: 'exact', head: true })
              .eq('task_type', 'support.ticket')
              .in('status', openStatuses)
              .eq('assigned_to', user.id)
          : Promise.resolve({ count: 0, error: null } as any),
        can('support.read')
          ? admin
              .from('admin_tasks')
              .select('id', { count: 'exact', head: true })
              .eq('task_type', 'support.ticket')
              .in('status', openStatuses)
              .is('assigned_to', null)
          : Promise.resolve({ count: 0, error: null } as any),
        can('crm.read')
          ? admin
              .from('admin_tasks')
              .select('id', { count: 'exact', head: true })
              .eq('task_type', 'crm.lead')
              .in('status', openStatuses)
              .eq('assigned_to', user.id)
          : Promise.resolve({ count: 0, error: null } as any),
        can('crm.read')
          ? admin
              .from('admin_tasks')
              .select('id', { count: 'exact', head: true })
              .eq('task_type', 'crm.lead')
              .in('status', openStatuses)
              .is('assigned_to', null)
          : Promise.resolve({ count: 0, error: null } as any),
      ]);

      if (tasksErr && !isMissingTable(tasksErr, 'admin_tasks')) {
        throw createError('DATABASE_ERROR', 'Failed to load admin tasks', 500, tasksErr.message);
      }

      const countErr =
        moderationMine?.error ||
        moderationUnassigned?.error ||
        supportMine?.error ||
        supportUnassigned?.error ||
        leadsMine?.error ||
        leadsUnassigned?.error;
      if (countErr && !isMissingTable(countErr, 'admin_tasks')) {
        throw createError('DATABASE_ERROR', 'Failed to load admin task stats', 500, (countErr as any)?.message);
      }

      myWork.moderation_claimed = moderationMine?.count ?? 0;
      myWork.moderation_unassigned = moderationUnassigned?.count ?? 0;
      myWork.support_assigned_to_me = supportMine?.count ?? 0;
      myWork.support_unassigned = supportUnassigned?.count ?? 0;
      myWork.leads_assigned_to_me = leadsMine?.count ?? 0;
      myWork.leads_unassigned = leadsUnassigned?.count ?? 0;

      for (const row of taskRows ?? []) {
        const meta = ((row as any).metadata ?? {}) as any;
        const countValue = typeof meta.count === 'number' ? meta.count : 1;
        if (!countValue) continue;

        const perm = getTaskPermission((row as any).task_type);
        const href = typeof meta.href === 'string' ? meta.href : taskHref((row as any).task_type);
        const createdAt = typeof meta.oldest_at === 'string' ? meta.oldest_at : ((row as any).created_at ?? null);
        const uiPriority = toUiPriority((row as any).priority);
        const canAssignToMe = Boolean(can('tasks.write') && perm?.write && can(perm.write) && !(row as any).assigned_to);

        tasks.push({
          type: 'admin.task',
          id: (row as any).id,
          priority: uiPriority,
          title: (row as any).title,
          subtitle: (row as any).description ?? '',
          meta: countValue > 1 ? `${countValue} élément(s)` : '',
          created_at: createdAt,
          owner: (row as any).assigned_to ?? null,
          owner_is_me: Boolean((row as any).assigned_to && (row as any).assigned_to === user.id),
          cta: canAssignToMe ? { kind: 'assign_to_me', label: 'Assigner à moi', href } : { kind: 'open', label: 'Voir', href },
          href,
        });
      }
    }

    // Sort tasks (priority first, then age)
    const priorityScore = (p: string) => (p === 'urgent' ? 4 : p === 'high' ? 3 : p === 'medium' ? 2 : 1);
    tasks.sort((a, b) => {
      const pa = priorityScore(a.priority);
      const pb = priorityScore(b.priority);
      if (pa !== pb) return pb - pa;
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return ta - tb;
    });
    const top10 = tasks.slice(0, 10);

    // ---- System health
    const health: any = {
      webhooks_failed_1h: 0,
      webhooks_failed_24h: 0,
      ingestion_errors_1h: 0,
      ingestion_errors_24h: 0,
      ingestion_jobs_failed_7d: 0,
      moderation_avg_review_minutes_7d: null as number | null,
      cashouts_avg_process_minutes_7d: null as number | null,
      support_avg_resolution_hours_7d: null as number | null,
    };

    if (can('integrations.read')) {
      const [{ count: w1h, error: w1hErr }, { count: w24h, error: w24hErr }] = await Promise.all([
        admin
          .from('webhook_deliveries')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'failed')
          .gte('created_at', since1hIso),
        admin
          .from('webhook_deliveries')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'failed')
          .gte('created_at', since24hIso),
      ]);
      if (w1hErr) throw createError('DATABASE_ERROR', 'Failed to load webhooks', 500, w1hErr.message);
      if (w24hErr) throw createError('DATABASE_ERROR', 'Failed to load webhooks', 500, w24hErr.message);
      health.webhooks_failed_1h = w1h ?? 0;
      health.webhooks_failed_24h = w24h ?? 0;
    }

    if (can('ingestion.read')) {
      const [{ count: e1h, error: e1hErr }, { count: e24h, error: e24hErr }, { count: j7d, error: j7dErr }] =
        await Promise.all([
          admin
            .from('ingestion_errors')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', since1hIso),
          admin
            .from('ingestion_errors')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', since24hIso),
          admin
            .from('ingestion_jobs')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'failed')
            .gte('created_at', since7dIso),
        ]);
      if (e1hErr) throw createError('DATABASE_ERROR', 'Failed to load ingestion', 500, e1hErr.message);
      if (e24hErr) throw createError('DATABASE_ERROR', 'Failed to load ingestion', 500, e24hErr.message);
      if (j7dErr) throw createError('DATABASE_ERROR', 'Failed to load ingestion', 500, j7dErr.message);
      health.ingestion_errors_1h = e1h ?? 0;
      health.ingestion_errors_24h = e24h ?? 0;
      health.ingestion_jobs_failed_7d = j7d ?? 0;
    }

    if (can('moderation.read')) {
      const { data, error } = await admin
        .from('moderation_queue')
        .select('created_at, reviewed_at')
        .not('reviewed_at', 'is', null)
        .gte('reviewed_at', since7dIso)
        .limit(250);
      if (error) throw createError('DATABASE_ERROR', 'Failed to load moderation times', 500, error.message);
      const durations = (data ?? [])
        .map((r) => diffMs(r.created_at as any, r.reviewed_at as any))
        .filter((v): v is number => typeof v === 'number' && v >= 0)
        .map((ms) => ms / 60_000);
      health.moderation_avg_review_minutes_7d = durations.length ? Math.round(avg(durations)) : null;
    }

    if (can('finance.read')) {
      const { data, error } = await admin
        .from('cashouts')
        .select('requested_at, processed_at, status')
        .not('processed_at', 'is', null)
        .in('status', ['paid', 'failed'])
        .gte('processed_at', since7dIso)
        .limit(250);
      if (error) throw createError('DATABASE_ERROR', 'Failed to load cashout times', 500, error.message);
      const durations = (data ?? [])
        .map((r) => diffMs(r.requested_at as any, r.processed_at as any))
        .filter((v): v is number => typeof v === 'number' && v >= 0)
        .map((ms) => ms / 60_000);
      health.cashouts_avg_process_minutes_7d = durations.length ? Math.round(avg(durations)) : null;
    }

    if (can('support.read')) {
      const { data, error } = await admin
        .from('support_tickets')
        .select('created_at, updated_at, status')
        .in('status', ['resolved', 'closed'])
        .gte('updated_at', since7dIso)
        .limit(250);
      if (error) throw createError('DATABASE_ERROR', 'Failed to load support times', 500, error.message);
      const durations = (data ?? [])
        .map((r) => diffMs(r.created_at as any, r.updated_at as any))
        .filter((v): v is number => typeof v === 'number' && v >= 0)
        .map((ms) => ms / 3_600_000);
      health.support_avg_resolution_hours_7d = durations.length ? Math.round(avg(durations) * 10) / 10 : null;
    }

    // ---- Marketing & growth (top lists)
    const marketing: any = { trending_contests: [], brands_to_relaunch: [], top_creators: [] };

    const { data: contests, error: contestsErr } = await admin
      .from('contest_stats')
      .select('contest_id, title, status, total_views, total_weighted_views, total_submissions, total_creators')
      .eq('status', 'active')
      .order('total_weighted_views', { ascending: false })
      .limit(5);
    if (contestsErr) {
      if (!isMissingTable(contestsErr, 'contest_stats')) {
        throw createError('DATABASE_ERROR', 'Failed to load contests', 500, contestsErr.message);
      }
      const fallback = await admin
        .from('contests')
        .select('id, title, status, created_at, updated_at')
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
        .limit(5);
      if (fallback.error) {
        throw createError('DATABASE_ERROR', 'Failed to load contests', 500, fallback.error.message);
      }
      marketing.trending_contests = (fallback.data ?? []).map((c: any) => ({
        contest_id: c.id,
        title: c.title,
        status: c.status,
        total_views: 0,
        total_weighted_views: 0,
        total_submissions: 0,
        total_creators: 0,
      }));
    } else {
      marketing.trending_contests = contests ?? [];
    }

    const { data: brands, error: brandsErr } = await admin
      .from('brand_dashboard_summary')
      .select('brand_id, active_contests, total_views, total_creators, last_contest_updated')
      .order('last_contest_updated', { ascending: true })
      .limit(8);
    if (brandsErr) {
      // optional view may not exist; ignore
      marketing.brands_to_relaunch = [];
    } else {
      const brandIds = (brands ?? []).map((b) => (b as any).brand_id).filter(Boolean);
      const { data: brandProfiles, error: profileErr } =
        brandIds.length === 0
          ? { data: [], error: null }
          : await admin
              .from('profile_brands')
              .select('user_id, company_name, website')
              .in('user_id', brandIds);
      if (profileErr) throw createError('DATABASE_ERROR', 'Failed to load brands', 500, profileErr.message);
      const brandMap = new Map((brandProfiles ?? []).map((b) => [b.user_id, b]));
      marketing.brands_to_relaunch = (brands ?? [])
        .filter((b: any) => (b.active_contests ?? 0) === 0)
        .slice(0, 5)
        .map((b: any) => ({
          brand_id: b.brand_id,
          company_name: brandMap.get(b.brand_id)?.company_name ?? b.brand_id,
          website: brandMap.get(b.brand_id)?.website ?? null,
          last_contest_updated: b.last_contest_updated ?? null,
        }));
    }

    const { data: creators, error: creatorsErr } = await admin
      .from('creator_dashboard_summary')
      .select('creator_id, total_views, total_earnings_cents, contests_participated, last_submission_updated')
      .order('total_views', { ascending: false })
      .limit(6);
    if (creatorsErr) {
      if (!isMissingTable(creatorsErr, 'creator_dashboard_summary')) {
        throw createError('DATABASE_ERROR', 'Failed to load creators', 500, creatorsErr.message);
      }
      marketing.top_creators = [];
    } else {
      const creatorIds = (creators ?? []).map((c: any) => c.creator_id).filter(Boolean);
      const { data: profiles, error: profilesErr } =
        creatorIds.length === 0
          ? { data: [], error: null }
          : await admin.from('profiles').select('id, display_name, email').in('id', creatorIds);
      if (profilesErr) throw createError('DATABASE_ERROR', 'Failed to load creators', 500, profilesErr.message);
      const map = new Map((profiles ?? []).map((p) => [p.id, p]));
      marketing.top_creators = (creators ?? []).map((c: any) => ({
        creator_id: c.creator_id,
        label: map.get(c.creator_id)?.display_name || map.get(c.creator_id)?.email || c.creator_id,
        total_views: c.total_views ?? 0,
        total_earnings_cents: c.total_earnings_cents ?? 0,
        contests_participated: c.contests_participated ?? 0,
        last_submission_updated: c.last_submission_updated ?? null,
      }));
    }

    // ---- Journal
    const [auditRes, eventRes] = await Promise.all([
      can('audit.read')
        ? admin
            .from('audit_logs')
            .select('id, actor_id, action, table_name, row_pk, created_at, actor:profiles(id, display_name, email)')
            .order('created_at', { ascending: false })
            .limit(12)
        : Promise.resolve({ data: [], error: null } as any),
      can('audit.read')
        ? admin
            .from('event_log')
            .select('id, event_name, user_id, org_id, created_at, user:profiles(id, display_name, email)')
            .order('created_at', { ascending: false })
            .limit(12)
        : Promise.resolve({ data: [], error: null } as any),
    ]);
    if (auditRes.error) throw createError('DATABASE_ERROR', 'Failed to load audit', 500, auditRes.error.message);
    if (eventRes.error) throw createError('DATABASE_ERROR', 'Failed to load events', 500, eventRes.error.message);

    // ---- Insights (recommendations)
    const insights: Array<{ key: string; severity: 'info' | 'warning' | 'danger'; title: string; message: string; href: string }> = [];

    if (can('finance.read')) {
      const { data: oldestCashout, error } = await admin
        .from('cashouts')
        .select('requested_at')
        .in('status', ['requested', 'processing'])
        .order('requested_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw createError('DATABASE_ERROR', 'Failed to load cashouts', 500, error.message);
      const oldestAt = (oldestCashout as any)?.requested_at ?? null;
      if (oldestAt) {
        const ageHours = Math.floor((Date.now() - new Date(oldestAt).getTime()) / (60 * 60 * 1000));
        if (ageHours >= 48) {
          insights.push({
            key: 'insight.cashouts_old',
            severity: 'warning',
            title: 'Cashouts en attente > 48h',
            message: `Le plus ancien cashout a ${ageHours}h.`,
            href: '/app/admin/finance?status=requested',
          });
        }
      }
    }

    if (can('moderation.read')) {
      const { data: oldestMod, error } = await admin
        .from('moderation_queue')
        .select('created_at')
        .in('status', ['pending', 'processing'])
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw createError('DATABASE_ERROR', 'Failed to load moderation', 500, error.message);
      const oldestAt = (oldestMod as any)?.created_at ?? null;
      if (oldestAt) {
        const ageHours = Math.floor((Date.now() - new Date(oldestAt).getTime()) / (60 * 60 * 1000));
        if (ageHours >= 24) {
          insights.push({
            key: 'insight.moderation_old',
            severity: 'warning',
            title: 'Modération en file > 24h',
            message: `Le plus ancien élément a ${ageHours}h.`,
            href: '/app/admin/moderation?status=pending',
          });
        }
      }
    }

    if (health.webhooks_failed_1h >= 10) {
      insights.push({
        key: 'insight.webhooks_spike',
        severity: 'danger',
        title: 'Spike webhooks en échec',
        message: `${health.webhooks_failed_1h} échec(s) sur la dernière heure.`,
        href: '/app/admin/integrations?delivery_status=failed',
      });
    }

    if (health.ingestion_errors_1h >= 10) {
      insights.push({
        key: 'insight.ingestion_spike',
        severity: 'danger',
        title: 'Spike erreurs ingestion',
        message: `${health.ingestion_errors_1h} erreur(s) sur la dernière heure.`,
        href: '/app/admin/ingestion',
      });
    }

    return NextResponse.json({
      generated_at: new Date().toISOString(),
      user_id: user.id,
      today: {
        views: withDelta(viewsToday, viewsYesterday, viewsWeekAgo),
        engagement: withDelta(engagementToday, engagementYesterday, engagementWeekAgo),
        new_users: withDelta(usersToday ?? 0, usersYesterday ?? 0, usersWeekAgo ?? 0),
        revenue_collected_cents: withDelta(revenueToday, revenueYesterday, revenueWeekAgo),
        pending_submissions: pendingSubmissions ?? 0,
        cashouts_pending: cashoutsPending ?? 0,
        support_open: supportOpen ?? 0,
      },
      todo: {
        my_work: myWork,
        items: top10,
      },
      health,
      marketing,
      journal: {
        audit: auditRes.data ?? [],
        events: eventRes.data ?? [],
      },
      insights,
    });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
