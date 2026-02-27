/**
 * Brand Contests List — Server component.
 *
 * Fetches all brand contests with submission/metrics stats, delegates
 * interactive UI (filters, table, drawer, actions) to CampaignsListClient.
 *
 * Data: same Supabase tables (contests, submissions, metrics_daily).
 * No new queries or RPCs introduced.
 */
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { Plus } from 'lucide-react';
import { TrackOnView } from '@/components/analytics/track-once';
import { CampaignsListClient } from './campaigns-list-client';
import type { CampaignRow } from './campaigns-list-client';

export const revalidate = 60;

export default async function BrandContestsPage() {
  const { user } = await getSession();
  if (!user) return null;

  const { contests, stats } = await fetchBrandContests(user.id);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <TrackOnView
        event="view_brand_contests"
        payload={{ total: contests.length }}
      />

      {/* ── Page Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[var(--text-1)]">
            Campagnes
          </h1>
          <p className="mt-1 text-sm text-[var(--text-2)]">
            Suivez vos concours et gérez les participations.
          </p>
        </div>
        <Link
          href="/app/brand/contests/new"
          className="inline-flex shrink-0 items-center gap-2 rounded-[var(--r2)] bg-[var(--cta-bg)] px-4 py-2.5 text-sm font-medium text-[var(--cta-fg)] transition-colors hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-void)]"
        >
          <Plus className="h-4 w-4" />
          Nouveau concours
        </Link>
      </div>

      {/* ── Client island: filters + table + drawer + actions ── */}
      <CampaignsListClient contests={contests} stats={stats} />
    </div>
  );
}

/* ─── Data fetching (server only) ─── */

async function fetchBrandContests(
  userId: string,
): Promise<{ contests: CampaignRow[]; stats: { active: number; draft: number; ended: number } }> {
  const supabase = await getSupabaseSSR();

  // 1. Fetch contests (filtre brand_id — ownership + RLS)
  const { data: contests, error: contestsError } = await supabase
    .from('contests')
    .select(
      'id, title, status, prize_pool_cents, currency, networks, start_at, end_at, created_at',
    )
    .eq('brand_id', userId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (contestsError || !contests?.length) {
    if (contestsError) console.error('Contests fetch error', contestsError);
    return { contests: [], stats: { active: 0, draft: 0, ended: 0 } };
  }

  // 2. Stats depuis les données déjà chargées (zéro requête extra)
  const stats = {
    active: contests.filter((c) => c.status === 'active').length,
    draft: contests.filter((c) => c.status === 'draft').length,
    ended: contests.filter((c) => c.status === 'ended').length,
  };

  const contestIds = contests.map((c) => c.id);

  // 3. Paralléliser: submissions (pending count) + contest_stats (views)
  // contest_stats est une VIEW Supabase qui agrège metrics_daily — évite le waterfall
  const [submissionsResult, contestStatsResult] = await Promise.all([
    supabase
      .from('submissions')
      .select('id, contest_id, status')
      .in('contest_id', contestIds),
    supabase
      .from('contest_stats')
      .select('contest_id, total_views, total_submissions')
      .in('contest_id', contestIds),
  ]);

  // 4. Build lookup maps (O(n) — pas de nested loops)
  const pendingByContest = new Map<string, number>();
  const totalByContest = new Map<string, number>();

  contestIds.forEach((id) => {
    pendingByContest.set(id, 0);
    totalByContest.set(id, 0);
  });

  submissionsResult.data?.forEach((s) => {
    if (s.status === 'pending') {
      pendingByContest.set(
        s.contest_id,
        (pendingByContest.get(s.contest_id) ?? 0) + 1,
      );
    }
    totalByContest.set(
      s.contest_id,
      (totalByContest.get(s.contest_id) ?? 0) + 1,
    );
  });

  const viewsByContest = new Map<string, number>();
  contestStatsResult.data?.forEach((cs) => {
    viewsByContest.set(cs.contest_id, Number(cs.total_views ?? 0));
  });

  // 5. Enrich contests — type CampaignRow inchangé
  const enrichedContests: CampaignRow[] = contests.map((c) => ({
    ...c,
    submissions_count: totalByContest.get(c.id) ?? 0,
    pending_submissions_count: pendingByContest.get(c.id) ?? 0,
    views: viewsByContest.get(c.id) ?? 0,
  }));

  return { contests: enrichedContests, stats };
}
