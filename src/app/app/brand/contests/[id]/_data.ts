import { getSupabaseSSR } from '@/lib/supabase/ssr';
import type {
  ContestDetail,
  ContestMetrics,
  LeaderboardEntry,
  SubmissionItem,
  ContestStatus,
} from './_types';

interface ContestRow {
  id: string;
  title: string;
  status: ContestStatus | string;
  brief_md: string | null;
  cover_url: string | null;
  budget_cents: number | null;
  prize_pool_cents: number | null;
  currency: string | null;
  start_at: string;
  end_at: string;
  networks: string[] | null;
  max_winners: number | null;
  created_at: string;
  updated_at: string;
}

interface ContestMetricsRow {
  total_submissions: number | null;
  approved_submissions: number | null;
  total_creators: number | null;
  total_views: number | null;
  total_likes: number | null;
  total_comments: number | null;
  total_shares: number | null;
  total_weighted_views: number | null;
}

interface ContestWinningRow {
  payout_cents: number | null;
}

interface LeaderboardRpcRow {
  rank: number | null;
  creator_id: string;
  total_weighted_views: number | null;
  total_views: number | null;
  total_likes: number | null;
  submission_count: number | null;
}

interface ProfileRow {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}

export async function getContestDetail(
  contestId: string,
  brandId: string,
): Promise<ContestDetail | null> {
  const supabase = await getSupabaseSSR();

  const { data, error } = await supabase
    .from('contests')
    .select(
      'id, title, status, brief_md, cover_url, budget_cents, prize_pool_cents, currency, start_at, end_at, networks, max_winners, created_at, updated_at, brand_id',
    )
    .eq('id', contestId)
    .eq('brand_id', brandId)
    .single();

  if (error || !data) {
    if (error) {
      // eslint-disable-next-line no-console
      console.error('Brand contest detail fetch error', error);
    }
    return null;
  }

  const row = data as ContestRow & { brand_id: string };

  return {
    id: row.id,
    title: row.title,
    status: (row.status as ContestStatus) ?? 'draft',
    briefMd: row.brief_md,
    coverUrl: row.cover_url,
    budgetCents: row.budget_cents ?? 0,
    prizePoolCents: row.prize_pool_cents ?? 0,
    currency: row.currency ?? 'EUR',
    startAt: row.start_at,
    endAt: row.end_at,
    networks: row.networks ?? [],
    maxWinners: row.max_winners ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getContestMetrics(
  contestId: string,
  prizePoolCents: number,
): Promise<ContestMetrics> {
  const supabase = await getSupabaseSSR();

  const [metricsResult, winningsResult] = await Promise.all([
    supabase.rpc('get_contest_metrics', { p_contest_id: contestId }),
    supabase
      .from('contest_winnings')
      .select('payout_cents')
      .eq('contest_id', contestId),
  ]);

  const row = (metricsResult.data?.[0] ?? null) as ContestMetricsRow | null;

  const budgetSpentCents =
    (winningsResult.data as ContestWinningRow[] | null)?.reduce(
      (sum, w) => sum + (w.payout_cents ?? 0),
      0,
    ) ?? 0;

  const totalViews = Number(row?.total_views ?? 0);
  const budgetRemainingCents = Math.max(0, prizePoolCents - budgetSpentCents);
  const cpv = totalViews > 0 ? budgetSpentCents / totalViews : null;

  if (!row || metricsResult.error) {
    if (metricsResult.error) {
      // eslint-disable-next-line no-console
      console.error('Brand contest metrics RPC error', metricsResult.error);
    }

    return {
      totalViews: 0,
      totalLikes: 0,
      totalComments: 0,
      totalShares: 0,
      totalWeightedViews: 0,
      totalSubmissions: 0,
      approvedSubmissions: 0,
      totalCreators: 0,
      budgetSpentCents,
      budgetRemainingCents,
      cpv: null,
    };
  }

  return {
    totalViews,
    totalLikes: Number(row.total_likes ?? 0),
    totalComments: Number(row.total_comments ?? 0),
    totalShares: Number(row.total_shares ?? 0),
    totalWeightedViews: Number(row.total_weighted_views ?? 0),
    totalSubmissions: Number(row.total_submissions ?? 0),
    approvedSubmissions: Number(row.approved_submissions ?? 0),
    totalCreators: Number(row.total_creators ?? 0),
    budgetSpentCents,
    budgetRemainingCents,
    cpv,
  };
}

export async function getContestSubmissions(
  contestId: string,
  status: 'all' | 'pending' | 'approved' | 'rejected',
  page: number,
  pageSize: number,
): Promise<{ submissions: SubmissionItem[]; total: number }> {
  const supabase = await getSupabaseSSR();

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('submissions')
    .select(
      `
        id,
        contest_id,
        creator_id,
        platform,
        external_url,
        thumbnail_url,
        status,
        rejection_reason,
        submitted_at,
        profiles!submissions_creator_id_fkey(display_name, avatar_url),
        metrics_daily(views, likes)
      `,
      { count: 'exact' },
    )
    .eq('contest_id', contestId)
    .order('submitted_at', { ascending: false })
    .range(from, to);

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error, count } = await query;

  if (error || !data) {
    if (error) {
      // eslint-disable-next-line no-console
      console.error('Brand contest submissions fetch error', error);
    }
    return { submissions: [], total: 0 };
  }

  const rows = (data as unknown) as Array<{
    id: string;
    contest_id: string;
    creator_id: string;
    platform: string | null;
    external_url: string | null;
    thumbnail_url: string | null;
    title: string | null;
    status: string;
    rejection_reason: string | null;
    submitted_at: string;
    profiles: { display_name: string | null; avatar_url: string | null } | null;
    metrics_daily: { views: number | null; likes: number | null }[] | null;
  }>;

  const submissions: SubmissionItem[] = rows.map((row) => {
    const metrics = row.metrics_daily?.[0];

    return {
      id: row.id,
      creatorId: row.creator_id,
      creatorName: row.profiles?.display_name ?? 'Creator',
      creatorAvatarUrl: row.profiles?.avatar_url ?? null,
      status: (row.status as SubmissionItem['status']) ?? 'pending',
      videoUrl: row.external_url,
      thumbnailUrl: row.thumbnail_url,
      views: Number(metrics?.views ?? 0),
      likes: Number(metrics?.likes ?? 0),
      platform: row.platform ?? 'unknown',
      submittedAt: row.submitted_at,
      rejectionReason: row.rejection_reason,
    };
  });

  return {
    submissions,
    total: count ?? submissions.length,
  };
}

export async function getContestLeaderboard(
  contestId: string,
  prizePoolCents: number,
  limit = 30,
): Promise<LeaderboardEntry[]> {
  const supabase = await getSupabaseSSR();

  const { data, error } = await supabase.rpc('get_contest_leaderboard', {
    p_contest_id: contestId,
    p_limit: limit,
  });

  if (error || !data || data.length === 0) {
    if (error) {
      // eslint-disable-next-line no-console
      console.error('Brand contest leaderboard RPC error', error);
    }
    return [];
  }

  const rpcRows = data as LeaderboardRpcRow[];
  const creatorIds = rpcRows.map((row) => row.creator_id);

  const { data: profilesData, error: profilesError } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url')
    .in('id', creatorIds);

  if (profilesError) {
    // eslint-disable-next-line no-console
    console.error('Brand contest leaderboard profiles error', profilesError);
  }

  const profileRows = (profilesData ?? []) as ProfileRow[];
  const profileMap = new Map<string, ProfileRow>(
    profileRows.map((profile) => [profile.id, profile]),
  );

  return rpcRows.map((row, index) => {
    const profile = profileMap.get(row.creator_id);

    return {
      rank: row.rank ?? index + 1,
      creatorId: row.creator_id,
      creatorName: profile?.display_name ?? 'Creator',
      creatorAvatarUrl: profile?.avatar_url ?? null,
      totalWeightedViews: Number(row.total_weighted_views ?? 0),
      totalViews: Number(row.total_views ?? 0),
      totalLikes: Number(row.total_likes ?? 0),
      submissionCount: Number(row.submission_count ?? 0),
      // Detailed prize allocation logic will be added in a later PR.
      estimatedPrizeCents: 0,
    };
  });
}

