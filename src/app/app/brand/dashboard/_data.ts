// Server-only data loader for the brand dashboard.
// Uses materialized view brand_dashboard_summary for aggregates
// and a lightweight contests query for the recent campaigns list.

import { getSupabaseSSR } from '@/lib/supabase/ssr';
import type { BrandDashboardStats, RecentContest } from './_types';

interface BrandDashboardSummaryRow {
  brand_id: string;
  active_contests: number;
  ended_contests: number;
  draft_contests: number;
  total_prize_pool_cents: number;
  total_budget_cents: number;
  total_submissions: number;
  total_creators: number;
  total_views: number;
  total_likes: number;
  total_comments: number;
  total_shares: number;
  last_contest_updated: string | null;
}

function buildLastNDays(n: number): { date: string; views: number; submissions: number }[] {
  const days: { date: string; views: number; submissions: number }[] = [];
  const today = new Date();

  for (let i = n - 1; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    days.push({
      date: date.toISOString().split('T')[0],
      views: 0,
      submissions: 0,
    });
  }

  return days;
}

function mapSummaryToStats(
  summary: BrandDashboardSummaryRow | null,
  timeseries:
    | { date: string; views: number; submissions: number }[]
    | null
    | undefined,
): BrandDashboardStats {
  const safeSummary = summary ?? {
    brand_id: '',
    active_contests: 0,
    ended_contests: 0,
    draft_contests: 0,
    total_prize_pool_cents: 0,
    total_budget_cents: 0,
    total_submissions: 0,
    total_creators: 0,
    total_views: 0,
    total_likes: 0,
    total_comments: 0,
    total_shares: 0,
    last_contest_updated: null,
  };

  const viewsOverTime = timeseries && timeseries.length > 0 ? timeseries : buildLastNDays(30);

  return {
    totalViews: Number(safeSummary.total_views ?? 0),
    // Delta vs last period will be wired to a dedicated RPC later.
    totalViewsDeltaPct: null,
    activeContests: Number(safeSummary.active_contests ?? 0),
    totalBudgetCents: Number(safeSummary.total_budget_cents ?? 0),
    // Pending/approved submissions come from live tables to stay precise.
    pendingSubmissions: 0,
    approvedSubmissions: 0,
    totalCreators: Number(safeSummary.total_creators ?? 0),
    viewsOverTime,
  };
}

interface ContestRow {
  id: string;
  title: string;
  status: string;
  end_at: string;
  submission_count?: number | null;
}

function mapContests(rows: ContestRow[]): RecentContest[] {
  return rows.map((row) => ({
    id: row.id,
    title: row.title ?? 'Untitled',
    status: row.status ?? 'draft',
    submissionCount: Number(row.submission_count ?? 0),
    // Per-contest views will be added via a dedicated RPC; keep zeroed for now.
    totalViews: 0,
    endAt: row.end_at as string,
  }));
}

export async function getDashboardData(brandId: string): Promise<{
  stats: BrandDashboardStats;
  recentContests: RecentContest[];
}> {
  const supabase = await getSupabaseSSR();

  const [summaryResult, contestsResult, timeseriesResult] = await Promise.all([
    supabase
      .from('brand_dashboard_summary')
      .select('*')
      .eq('brand_id', brandId)
      .maybeSingle<BrandDashboardSummaryRow>(),
    supabase
      .from('contests')
      .select('id, title, status, end_at')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
      .limit(5),
    // Timeseries RPC (optional). If it does not exist yet or fails,
    // we fall back to a 30-day zeroed timeseries.
    supabase.rpc('get_brand_views_timeseries', {
      p_brand_id: brandId,
      p_days: 30,
    }),
  ]);

  const timeseriesData =
    !timeseriesResult.error && Array.isArray(timeseriesResult.data)
      ? (timeseriesResult.data as { date: string; views: number; submissions: number }[])
      : null;

  const stats = mapSummaryToStats(summaryResult.data ?? null, timeseriesData);

  const contestRows = (contestsResult.data ?? []) as ContestRow[];
  const contestIds = contestRows.map((row) => row.id);

  let pendingSubmissions = 0;
  let approvedSubmissions = 0;

  if (contestIds.length > 0) {
    const pendingApprovedResult = await supabase
      .from('submissions')
      .select('status, contest_id')
      .in('contest_id', contestIds);

    if (!pendingApprovedResult.error && Array.isArray(pendingApprovedResult.data)) {
      for (const row of pendingApprovedResult.data as { status: string; contest_id: string }[]) {
        if (row.status === 'pending') pendingSubmissions += 1;
        if (row.status === 'approved') approvedSubmissions += 1;
      }
    }
  }

  const withSubmissionCounts: ContestRow[] = contestRows.map((row) => ({
    ...row,
    submission_count: 0,
  }));

  const recentContests = mapContests(withSubmissionCounts);

  return {
    stats: {
      ...stats,
      pendingSubmissions,
      approvedSubmissions,
    },
    recentContests,
  };
}

