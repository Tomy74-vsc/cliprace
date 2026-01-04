import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { createError, formatErrorResponse } from '@/lib/errors';

const QuerySchema = z.object({
  table_name: z.string().optional(),
  action: z.string().optional(),
  actor_id: z.string().uuid().optional(),
  row_pk: z.string().uuid().optional(),
  q: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  page: z.coerce.number().min(1).default(1),
});

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  try {
    await requireAdminPermission('audit.read');
    const parsed = QuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
    const query = parsed.success ? parsed.data : QuerySchema.parse({});
    const limit = query.limit;
    const from = (query.page - 1) * limit;
    const to = from + limit - 1;

    const admin = getAdminClient();
    let auditQuery = admin
      .from('audit_logs')
      .select(
        'id, actor_id, action, table_name, row_pk, old_values, new_values, ip, user_agent, created_at, actor:profiles(id, display_name, email)',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    if (query.table_name) {
      auditQuery = auditQuery.eq('table_name', query.table_name);
    }
    if (query.action) {
      auditQuery = auditQuery.eq('action', query.action);
    }
    if (query.actor_id) {
      auditQuery = auditQuery.eq('actor_id', query.actor_id);
    }
    if (query.row_pk) {
      auditQuery = auditQuery.eq('row_pk', query.row_pk);
    }
    if (query.q) {
      const trimmed = query.q.trim();
      if (uuidPattern.test(trimmed)) {
        auditQuery = auditQuery.eq('row_pk', trimmed);
      } else {
        const like = `%${trimmed}%`;
        auditQuery = auditQuery.or(`action.ilike.${like},table_name.ilike.${like}`);
      }
    }

    const { data: items, error, count } = await auditQuery;
    if (error) {
      throw createError('DATABASE_ERROR', 'Failed to load audit logs', 500, error.message);
    }

    return NextResponse.json({
      items: items ?? [],
      pagination: { total: count ?? 0, page: query.page, limit },
    });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
