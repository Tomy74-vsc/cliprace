import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { createError, formatErrorResponse } from '@/lib/errors';

const QuerySchema = z.object({
  status: z.enum(['queued', 'running', 'succeeded', 'failed']).optional(),
  account_id: z.string().uuid().optional(),
  kind: z.string().optional(),
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
    let jobsQuery = admin
      .from('ingestion_jobs')
      .select(
        'id, account_id, kind, scheduled_at, status, attempts, last_error, created_at, updated_at, account:platform_accounts(id, user_id, platform, handle, user:profiles(id, display_name, email))',
        { count: 'exact' }
      )
      .order('scheduled_at', { ascending: false })
      .range(from, to);

    if (query.status) jobsQuery = jobsQuery.eq('status', query.status);
    if (query.account_id) jobsQuery = jobsQuery.eq('account_id', query.account_id);
    if (query.kind) jobsQuery = jobsQuery.eq('kind', query.kind);
    if (query.q) {
      const like = `%${query.q.trim()}%`;
      jobsQuery = jobsQuery.or(`kind.ilike.${like},last_error.ilike.${like}`);
    }

    const { data: items, error, count } = await jobsQuery;
    if (error) {
      throw createError('DATABASE_ERROR', 'Failed to load ingestion jobs', 500, error.message);
    }

    return NextResponse.json({
      items: items ?? [],
      pagination: { total: count ?? 0, page: query.page, limit },
    });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
