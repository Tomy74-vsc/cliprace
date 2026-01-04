import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdminPermission, hasAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { createError, formatErrorResponse } from '@/lib/errors';
import { ensureAdminTasksSynced } from '@/lib/admin/admin-tasks-sync';
import { getAllowedTaskTypes, taskHref } from '@/lib/admin/admin-tasks';

type SupabaseErrorLike = { message?: string; code?: string } | null | undefined;

function isMissingTable(error: SupabaseErrorLike, tableName: string) {
  const code = String((error as any)?.code || '').toUpperCase();
  if (code === '42P01') return true;
  const msg = String((error as any)?.message || '').toLowerCase();
  if (!msg.includes(tableName.toLowerCase())) return false;
  return msg.includes('does not exist') || msg.includes('could not find') || msg.includes('schema cache');
}

const QuerySchema = z.object({
  scope: z.enum(['team', 'mine', 'unassigned']).default('team'),
  status: z.enum(['open', 'in_progress', 'blocked', 'done', 'canceled']).optional(),
  type: z.string().optional(),
  q: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(30),
  page: z.coerce.number().min(1).default(1),
});

export async function GET(req: NextRequest) {
  try {
    const { user, access } = await requireAdminPermission('tasks.read');
    await enforceAdminRateLimit(req, { route: 'admin:tasks:list', max: 60, windowMs: 60_000 });

    const parsed = QuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
    const query = parsed.success ? parsed.data : QuerySchema.parse({});

    await ensureAdminTasksSynced();

    const allowedTypes = getAllowedTaskTypes(access);
    if (allowedTypes.length === 0) {
      return NextResponse.json({ items: [], pagination: { total: 0, page: query.page, limit: query.limit } });
    }

    const admin = getAdminClient();
    const from = (query.page - 1) * query.limit;
    const to = from + query.limit - 1;

    let q: any = admin
      .from('admin_tasks')
      .select(
        'id, source_table, source_id, task_type, title, description, priority, status, assigned_to, due_at, metadata, created_at, updated_at, assigned:profiles(id, display_name, email)',
        { count: 'exact' }
      )
      .in('task_type', allowedTypes as any)
      .order('created_at', { ascending: true })
      .range(from, to);

    if (!query.status) {
      q = q.in('status', ['open', 'in_progress', 'blocked']);
    } else {
      q = q.eq('status', query.status);
    }

    if (query.scope === 'mine') q = q.eq('assigned_to', user.id);
    if (query.scope === 'unassigned') q = q.is('assigned_to', null);

    if (query.type) q = q.eq('task_type', query.type);

    if (query.q) {
      const like = `%${query.q.trim()}%`;
      q = q.or(`title.ilike.${like},description.ilike.${like}`);
    }

    const { data, error, count } = await q;
    if (error) {
      if (isMissingTable(error, 'admin_tasks')) {
        return NextResponse.json({ items: [], pagination: { total: 0, page: query.page, limit: query.limit } });
      }
      throw createError('DATABASE_ERROR', 'Failed to load admin tasks', 500, error.message);
    }

    const canWriteTasks = hasAdminPermission(access, 'tasks.write');

    const items = (data ?? []).map((row: any) => {
      const meta = (row.metadata ?? {}) as any;
      const countValue = typeof meta.count === 'number' ? meta.count : 1;
      const href = typeof meta.href === 'string' ? meta.href : taskHref(row.task_type);
      return {
        id: row.id,
        task_type: row.task_type,
        title: row.title,
        description: row.description,
        priority: row.priority,
        status: row.status,
        assigned_to: row.assigned_to,
        assigned: row.assigned ?? null,
        due_at: row.due_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
        href,
        count: countValue,
        oldest_at: typeof meta.oldest_at === 'string' ? meta.oldest_at : null,
        can_write: canWriteTasks,
      };
    });

    return NextResponse.json({
      items,
      pagination: { total: count ?? 0, page: query.page, limit: query.limit },
    });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
