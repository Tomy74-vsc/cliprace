import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { createError, formatErrorResponse } from '@/lib/errors';

const QuerySchema = z.object({
  contest_id: z.string().uuid().optional(),
  type: z.enum(['image', 'video', 'pdf']).optional(),
  q: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  page: z.coerce.number().min(1).default(1),
});

export async function GET(req: NextRequest) {
  try {
    await requireAdminPermission('taxonomy.read');
    const parsed = QuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
    const query = parsed.success ? parsed.data : QuerySchema.parse({});
    const limit = query.limit;
    const from = (query.page - 1) * limit;
    const to = from + limit - 1;

    const admin = getAdminClient();
    let assetsQuery = admin
      .from('contest_assets')
      .select('id, contest_id, url, type, created_at, contest:contests(id, title, brand_id)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (query.contest_id) assetsQuery = assetsQuery.eq('contest_id', query.contest_id);
    if (query.type) assetsQuery = assetsQuery.eq('type', query.type);
    if (query.q) {
      const like = `%${query.q.trim()}%`;
      assetsQuery = assetsQuery.or(`url.ilike.${like}`);
    }

    const { data: items, error, count } = await assetsQuery;
    if (error) {
      throw createError('DATABASE_ERROR', 'Failed to load contest assets', 500, error.message);
    }

    return NextResponse.json({
      items: items ?? [],
      pagination: { total: count ?? 0, page: query.page, limit },
    });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
