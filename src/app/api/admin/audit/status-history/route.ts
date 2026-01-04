import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { createError, formatErrorResponse } from '@/lib/errors';

const QuerySchema = z.object({
  table_name: z.string().optional(),
  new_status: z.string().optional(),
  changed_by: z.string().uuid().optional(),
  row_id: z.string().uuid().optional(),
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
    let historyQuery = admin
      .from('status_history')
      .select(
        'id, table_name, row_id, old_status, new_status, changed_by, reason, metadata, created_at, actor:profiles(id, display_name, email)',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    if (query.table_name) {
      historyQuery = historyQuery.eq('table_name', query.table_name);
    }
    if (query.new_status) {
      historyQuery = historyQuery.eq('new_status', query.new_status);
    }
    if (query.changed_by) {
      historyQuery = historyQuery.eq('changed_by', query.changed_by);
    }
    if (query.row_id) {
      historyQuery = historyQuery.eq('row_id', query.row_id);
    }
    if (query.q) {
      const trimmed = query.q.trim();
      if (uuidPattern.test(trimmed)) {
        historyQuery = historyQuery.eq('row_id', trimmed);
      } else {
        const like = `%${trimmed}%`;
        historyQuery = historyQuery.or(`table_name.ilike.${like},new_status.ilike.${like},reason.ilike.${like}`);
      }
    }

    const { data: items, error, count } = await historyQuery;
    if (error) {
      throw createError('DATABASE_ERROR', 'Failed to load status history', 500, error.message);
    }

    return NextResponse.json({
      items: items ?? [],
      pagination: { total: count ?? 0, page: query.page, limit },
    });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
