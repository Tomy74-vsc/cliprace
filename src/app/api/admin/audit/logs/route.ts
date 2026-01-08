import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { KeysetPaginationSchema, decodeCursor, extractNextCursor } from '@/lib/admin/pagination';
import { createError, formatErrorResponse } from '@/lib/errors';

const QuerySchema = KeysetPaginationSchema.extend({
  table_name: z.string().optional(),
  action: z.string().optional(),
  actor_id: z.string().uuid().optional(),
  row_pk: z.string().uuid().optional(),
  q: z.string().optional(),
});

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  try {
    await requireAdminPermission('audit.read');
    const parsed = QuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
    const query = parsed.success ? parsed.data : QuerySchema.parse({});
    const limit = query.limit;
    const cursor = decodeCursor(query.cursor);

    const admin = getAdminClient();
    let auditQuery = admin
      .from('audit_logs')
      .select('id, actor_id, action, table_name, row_pk, old_values, new_values, ip, user_agent, created_at, actor:profiles(id, display_name, email)');

    // Appliquer filtres d'abord
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

    // Appliquer keyset pagination après les filtres
    auditQuery = auditQuery
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit + 1);

    if (cursor) {
      // Pagination keyset : created_at < cursor.created_at OU (created_at = cursor.created_at ET id < cursor.id)
      auditQuery = auditQuery.or(
        `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`
      );
    }

    const { data: items, error } = await auditQuery;
    if (error) {
      throw createError('DATABASE_ERROR', 'Failed to load audit logs', 500, error.message);
    }

    const allItems = (items ?? []) as Array<{ created_at: string; id: string }>;
    const hasMore = allItems.length > limit;
    const finalItems = hasMore ? allItems.slice(0, limit) : allItems;
    const nextCursor = hasMore ? extractNextCursor(finalItems, limit) : null;

    return NextResponse.json({
      items: finalItems,
      pagination: {
        limit,
        nextCursor,
        hasMore,
      },
    });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
