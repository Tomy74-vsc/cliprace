import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { createError, formatErrorResponse } from '@/lib/errors';

const QuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  page: z.coerce.number().min(1).default(1),
  action: z.string().optional(),
  target_table: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    await requireAdminPermission('moderation.read');
    const parsed = QuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
    const query = parsed.success ? parsed.data : QuerySchema.parse({});
    const limit = query.limit;
    const from = (query.page - 1) * limit;
    const to = from + limit - 1;

    const admin = getAdminClient();
    let historyQuery = admin
      .from('moderation_actions')
      .select('id, target_table, target_id, action, reason, actor_id, created_at, actor:profiles(id, display_name, email)', {
        count: 'exact',
      })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (query.action) {
      historyQuery = historyQuery.eq('action', query.action);
    }
    if (query.target_table) {
      historyQuery = historyQuery.eq('target_table', query.target_table);
    }

    const { data, error, count } = await historyQuery;
    if (error) {
      throw createError('DATABASE_ERROR', 'Failed to load moderation history', 500, error.message);
    }

    return NextResponse.json({
      items: data ?? [],
      pagination: {
        total: count ?? 0,
        page: query.page,
        limit,
      },
    });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
