import { getSupabaseSSR } from '@/lib/supabase/ssr';
import type { ContestListItem, ContestsFilters, ContestStatus } from './_types';

interface ContestRow {
  id: string;
  title: string;
  status: ContestStatus | string;
  budget_cents: number;
  prize_pool_cents: number;
  currency: string | null;
  start_at: string;
  end_at: string;
  created_at: string;
  networks: string[] | null;
}

interface ContestStatsRow {
  contest_id: string;
  total_submissions: number | null;
  approved_submissions: number | null;
  total_views: number | null;
  total_creators: number | null;
}

export async function getContestsList(
  brandId: string,
  filters: ContestsFilters,
  page = 1,
  pageSize = 20,
): Promise<{ contests: ContestListItem[]; total: number }> {
  const supabase = await getSupabaseSSR();

  const offset = (page - 1) * pageSize;

  let query = supabase
    .from('contests')
    .select(
      'id, title, status, budget_cents, prize_pool_cents, currency, start_at, end_at, created_at, networks',
      { count: 'exact' },
    )
    .eq('brand_id', brandId);

  if (filters.search.trim().length > 0) {
    query = query.ilike('title', `%${filters.search.trim()}%`);
  }

  if (filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  query = query.order(filters.sortBy, { ascending: filters.sortDir === 'asc' });
  query = query.range(offset, offset + pageSize - 1);

  const { data: contests, error, count } = await query;

  if (error || !contests) {
    if (error) {
      // eslint-disable-next-line no-console
      console.error('Brand contests list fetch error', error);
    }
    return { contests: [], total: 0 };
  }

  const contestRows = contests as ContestRow[];
  const contestIds = contestRows.map((c) => c.id);

  let statsByContest = new Map<string, ContestStatsRow>();

  if (contestIds.length > 0) {
    const { data: statsData, error: statsError } = await supabase
      .from('contest_stats')
      .select(
        'contest_id, total_submissions, approved_submissions, total_views, total_creators',
      )
      .in('contest_id', contestIds);

    if (!statsError && statsData) {
      statsByContest = new Map(
        (statsData as ContestStatsRow[]).map((row) => [row.contest_id, row]),
      );
    }
  }

  const items: ContestListItem[] = contestRows.map((row) => {
    const stats = statsByContest.get(row.id);

    const submissionCount = Number(stats?.total_submissions ?? 0);
    const approvedCount = Number(stats?.approved_submissions ?? 0);
    const totalViews = Number(stats?.total_views ?? 0);
    const creatorCount = Number(stats?.total_creators ?? 0);

    return {
      id: row.id,
      title: row.title,
      status: (row.status as ContestStatus) ?? 'draft',
      budgetCents: row.budget_cents ?? 0,
      prizePoolCents: row.prize_pool_cents ?? 0,
      currency: row.currency ?? 'EUR',
      submissionCount,
      approvedCount,
      totalViews,
      creatorCount,
      startAt: row.start_at,
      endAt: row.end_at,
      createdAt: row.created_at,
      networks: row.networks ?? [],
    };
  });

  return {
    contests: items,
    total: count ?? items.length,
  };
}

