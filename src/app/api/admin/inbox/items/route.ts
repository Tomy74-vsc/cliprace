import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdminPermission, hasAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { ensureAdminTasksSynced } from '@/lib/admin/admin-tasks-sync';
import { adminCache, cacheKey } from '@/lib/admin/cache';
import { createError, formatErrorResponse } from '@/lib/errors';
import { getAllowedTaskTypes, getTaskPermission, taskHref, toUiPriority } from '@/lib/admin/admin-tasks';

const QuerySchema = z.object({
  kind: z.enum(['ops', 'signals']).default('ops'),
  scope: z.enum(['team', 'mine', 'unassigned']).optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
});

function hoursBetween(fromIso: string | null) {
  if (!fromIso) return null;
  const t = new Date(fromIso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.round((Date.now() - t) / (60 * 60 * 1000)));
}

function hoursUntil(toIso: string | null) {
  if (!toIso) return null;
  const t = new Date(toIso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.round((t - Date.now()) / (60 * 60 * 1000));
}

type SupabaseErrorLike = { message?: string; code?: string } | null | undefined;

function isMissingTable(error: SupabaseErrorLike, tableName: string) {
  const code = String((error as UnsafeAny)?.code || '').toUpperCase();
  if (code === '42P01') return true;
  const msg = String((error as UnsafeAny)?.message || '').toLowerCase();
  if (!msg.includes(tableName.toLowerCase())) return false;
  return msg.includes('does not exist') || msg.includes('could not find') || msg.includes('schema cache');
}

type OpsInboxItem = {
  id: string;
  task_type: string;
  title: string;
  description: string | null;
  href: string;
  count: number;
  oldest_at: string | null;
  age_hours: number | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: string;
  owner: string | null;
  owner_label: string | null;
  can_assign_to_me: boolean;
  can_write: boolean;
  due_at: string | null;
  sla_hours: number | null;
  sla_status: 'overdue' | 'warning' | 'ok' | null;
};

export async function GET(req: NextRequest) {
  try {
    const { user, access } = await requireAdminPermission('inbox.read');
    const can = (permission: string) => hasAdminPermission(access, permission);
    const canWriteTasks = can('tasks.write');

    const parsed = QuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
    const query = parsed.success ? parsed.data : QuerySchema.parse({});

    if (query.kind === 'signals') {
      const summaryRes = await fetch(new URL('/api/admin/inbox/summary', req.nextUrl.origin), {
        headers: { cookie: req.headers.get('cookie') || '' },
        cache: 'no-store',
      });
      if (!summaryRes.ok) throw createError('UNKNOWN', 'Failed to load inbox summary', 500);
      const data = await summaryRes.json();
      return NextResponse.json({ kind: 'signals', items: data?.signals?.items ?? [] });
    }

    const cacheId = cacheKey('admin:inbox:items', {
      user_id: user.id,
      scope: query.scope || 'team',
      limit: query.limit,
    });

    const payload = await adminCache.getOrSet(
      cacheId,
      async () => {
        await ensureAdminTasksSynced();

        const admin = getAdminClient();
        const allowedTypes = getAllowedTaskTypes(access);
        if (allowedTypes.length === 0) return { kind: 'ops', items: [] as OpsInboxItem[] };

        let tasksQuery: UnsafeAny = admin
          .from('admin_tasks')
          .select(
            'id, task_type, title, description, priority, status, assigned_to, due_at, metadata, created_at, assigned:profiles(id, display_name, email)'
          )
          .in('task_type', allowedTypes as UnsafeAny)
          .in('status', ['open', 'in_progress', 'blocked'])
          .order('priority', { ascending: false }) // Tri par priority d'abord
          .order('due_at', { ascending: true, nullsFirst: false }) // Puis par due_at (SLA)
          .order('created_at', { ascending: true })
          .limit(Math.max(100, query.limit));

        if (query.scope === 'mine') tasksQuery = tasksQuery.eq('assigned_to', user.id);
        if (query.scope === 'unassigned') tasksQuery = tasksQuery.is('assigned_to', null);

        const { data: tasks, error } = await tasksQuery;
        if (error) {
          if (isMissingTable(error, 'admin_tasks')) return { kind: 'ops', items: [] as OpsInboxItem[] };
          throw createError('DATABASE_ERROR', 'Failed to load admin tasks', 500, error.message);
        }

        const items: OpsInboxItem[] = [];

    for (const row of tasks ?? []) {
      const meta = ((row as UnsafeAny).metadata ?? {}) as UnsafeAny;
      const countValue = typeof meta.count === 'number' ? meta.count : 1;
      if (!countValue) continue;

      const href = typeof meta.href === 'string' ? meta.href : taskHref((row as UnsafeAny).task_type);
      const oldestAt = typeof meta.oldest_at === 'string' ? meta.oldest_at : null;
      const ageHours = hoursBetween(oldestAt ?? ((row as UnsafeAny).created_at ?? null));
      const perm = getTaskPermission((row as UnsafeAny).task_type);

      const dueAt = typeof (row as UnsafeAny).due_at === 'string' ? (row as UnsafeAny).due_at : null;
       const slaHours = dueAt ? hoursUntil(dueAt) : null;
       const slaStatus = slaHours !== null ? (slaHours < 0 ? 'overdue' : slaHours < 24 ? 'warning' : 'ok') : null;

      items.push({
        id: (row as UnsafeAny).id,
        task_type: (row as UnsafeAny).task_type,
        title: (row as UnsafeAny).title,
        description: (row as UnsafeAny).description ?? null,
        href,
        count: countValue,
        oldest_at: oldestAt,
        age_hours: ageHours,
        priority: toUiPriority((row as UnsafeAny).priority),
        status: (row as UnsafeAny).status,
        owner: (row as UnsafeAny).assigned_to ?? null,
        owner_label: (row as UnsafeAny).assigned ? ((row as UnsafeAny).assigned.display_name || (row as UnsafeAny).assigned.email) : null,
        can_assign_to_me: Boolean(canWriteTasks && perm?.write && can(perm.write) && !(row as UnsafeAny).assigned_to),
        can_write: canWriteTasks,
        due_at: dueAt,
        sla_hours: slaHours,
        sla_status: slaStatus,
      });
    }

    const priorityScore = (p: string) => (p === 'urgent' ? 4 : p === 'high' ? 3 : p === 'medium' ? 2 : 1);
    items.sort((a, b) => {
      const pa = priorityScore(a.priority);
      const pb = priorityScore(b.priority);
      if (pa !== pb) return pb - pa;
      return (b.age_hours ?? 0) - (a.age_hours ?? 0);
    });

        return { kind: 'ops', items: items.slice(0, query.limit) };
      },
      3_000
    );

    return NextResponse.json(payload);
  } catch (error) {
    return formatErrorResponse(error);
  }
}

