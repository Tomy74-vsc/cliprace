import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { createError, formatErrorResponse } from '@/lib/errors';

const QuerySchema = z.object({
  platform: z.string().optional(),
  user_id: z.string().uuid().optional(),
  q: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  page: z.coerce.number().min(1).default(1),
});

export async function GET(req: NextRequest) {
  try {
    await requireAdminPermission('ingestion.read');
    const parsed = QuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
    const query = parsed.success ? parsed.data : QuerySchema.parse({});
    const limit = query.limit;
    const from = (query.page - 1) * limit;
    const to = from + limit - 1;

    const admin = getAdminClient();
    let accountsQuery = admin
      .from('platform_accounts')
      .select(
        'id, user_id, platform, platform_user_id, handle, created_at, user:profiles(id, display_name, email)',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    if (query.platform) accountsQuery = accountsQuery.eq('platform', query.platform);
    if (query.user_id) accountsQuery = accountsQuery.eq('user_id', query.user_id);
    if (query.q) {
      const like = `%${query.q.trim()}%`;
      accountsQuery = accountsQuery.or(`handle.ilike.${like},platform_user_id.ilike.${like}`);
    }

    const { data: items, error, count } = await accountsQuery;
    if (error) {
      throw createError('DATABASE_ERROR', 'Failed to load platform accounts', 500, error.message);
    }

    return NextResponse.json({
      items: items ?? [],
      pagination: { total: count ?? 0, page: query.page, limit },
    });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
