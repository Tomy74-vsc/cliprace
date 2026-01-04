import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { createError, formatErrorResponse } from '@/lib/errors';

const QuerySchema = z.object({
  status: z.string().optional(),
  q: z.string().optional(),
  brand_id: z.string().uuid().optional(),
  org_id: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  page: z.coerce.number().min(1).default(1),
});

export async function GET(req: NextRequest) {
  try {
    await requireAdminPermission('contests.read');
    const parsed = QuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
    const query = parsed.success ? parsed.data : QuerySchema.parse({});
    const limit = query.limit;
    const from = (query.page - 1) * limit;
    const to = from + limit - 1;

    const admin = getAdminClient();
    let contestsQuery = admin
      .from('contests')
      .select(
        'id, title, slug, status, start_at, end_at, prize_pool_cents, budget_cents, created_at, brand_id, org_id, brand:profiles(id, display_name, email), org:orgs(id, name)',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    if (query.status) {
      contestsQuery = contestsQuery.eq('status', query.status);
    }
    if (query.brand_id) {
      contestsQuery = contestsQuery.eq('brand_id', query.brand_id);
    }
    if (query.org_id) {
      contestsQuery = contestsQuery.eq('org_id', query.org_id);
    }
    if (query.q) {
      const q = `%${query.q}%`;
      contestsQuery = contestsQuery.or(`title.ilike.${q},slug.ilike.${q}`);
    }

    const { data: contests, error, count } = await contestsQuery;
    if (error) {
      throw createError('DATABASE_ERROR', 'Failed to load contests', 500, error.message);
    }

    const contestIds = (contests ?? []).map((contest) => contest.id);
    let statsMap = new Map<string, { total_submissions: number; total_views: number }>();
    if (contestIds.length > 0) {
      const { data: statsRows, error: statsError } = await admin
        .from('contest_stats')
        .select('contest_id, total_submissions, total_views')
        .in('contest_id', contestIds);
      if (statsError) {
        throw createError('DATABASE_ERROR', 'Failed to load contest stats', 500, statsError.message);
      }
      statsMap = new Map(
        (statsRows ?? []).map((row) => [
          row.contest_id,
          {
            total_submissions: row.total_submissions ?? 0,
            total_views: row.total_views ?? 0,
          },
        ])
      );
    }

    const items = (contests ?? []).map((contest) => ({
      ...contest,
      stats: statsMap.get(contest.id) ?? { total_submissions: 0, total_views: 0 },
    }));

    return NextResponse.json({
      items,
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
