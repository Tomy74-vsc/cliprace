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

  // 1. Fetch all brand contests (capped at 200 for safety)
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

  // 2. Compute stats from same data (avoids a second query)
  const stats = {
    active: contests.filter((c) => c.status === 'active').length,
    draft: contests.filter((c) => c.status === 'draft').length,
    ended: contests.filter((c) => c.status === 'ended').length,
  };

  // 3. Fetch submissions for all contests
  const contestIds = contests.map((c) => c.id);
  const { data: submissions } = await supabase
    .from('submissions')
    .select('id, contest_id, status')
    .in('contest_id', contestIds);

  // Build submission → contest map + per-contest stats
  const subToContest = new Map<string, string>();
  const contestStats = new Map<
    string,
    { total: number; pending: number; views: number }
  >();

  contestIds.forEach((id) =>
    contestStats.set(id, { total: 0, pending: 0, views: 0 }),
  );

  submissions?.forEach((s) => {
    subToContest.set(s.id, s.contest_id);
    const entry = contestStats.get(s.contest_id);
    if (entry) {
      entry.total++;
      if (s.status === 'pending') entry.pending++;
    }
  });

  // 4. Fetch views from metrics_daily
  const submissionIds = submissions?.map((s) => s.id) || [];

  if (submissionIds.length > 0) {
    const { data: metrics } = await supabase
      .from('metrics_daily')
      .select('submission_id, views')
      .in('submission_id', submissionIds);

    metrics?.forEach((m: { submission_id: string; views: number }) => {
      const contestId = subToContest.get(m.submission_id);
      if (contestId) {
        const entry = contestStats.get(contestId);
        if (entry) entry.views += m.views || 0;
      }
    });
  }

  // 5. Enrich contests with computed stats
  const enrichedContests: CampaignRow[] = contests.map((c) => ({
    ...c,
    submissions_count: contestStats.get(c.id)?.total || 0,
    pending_submissions_count: contestStats.get(c.id)?.pending || 0,
    views: contestStats.get(c.id)?.views || 0,
  }));

  return { contests: enrichedContests, stats };
}
