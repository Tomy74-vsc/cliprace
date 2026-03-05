/**
 * Brand Contests List — Server component.
 *
 * Refonte layout:
 * - Sections verticales (Live / Révision / En attente / Brouillons / Terminés)
 * - Cards horizontales larges avec visuel plateforme à gauche
 * - Aucune logique de fetch modifiée (mêmes tables / vues Supabase)
 */
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { Plus, Trophy, Zap } from 'lucide-react';
import { TrackOnView } from '@/components/analytics/track-once';
import { BrandEmptyState } from '@/components/brand/empty-state-enhanced';
import { StatusBadge } from '@/components/brand-ui';
import type { CampaignRow } from './campaigns-list-client';
import { CollapsibleSection } from './collapsible-section';
import { cn } from '@/lib/utils';

export const revalidate = 60;

const ctaClass = cn(
  'inline-flex items-center gap-2 rounded-[var(--r2)] px-4 py-2.5',
  'bg-[var(--cta-bg)] text-[var(--cta-fg)]',
  'text-sm font-medium',
  'hover:bg-white/90 transition-colors',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50',
  'focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-void)]',
);

const secondarySmallClass = cn(
  'inline-flex items-center gap-1.5 rounded-[var(--r2)] border border-[var(--border-1)]',
  'px-3 py-1.5 text-xs font-medium text-[var(--text-2)]',
  'transition-colors hover:border-[var(--border-2)] hover:text-[var(--text-1)]',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
);

function formatViews(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString('fr-FR');
}

function computeProgressPct(startAt?: string | null, endAt?: string | null, now: Date = new Date()): number {
  if (!startAt || !endAt) return 0;
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return 0;
  }
  const totalMs = end.getTime() - start.getTime();
  const elapsedMs = now.getTime() - start.getTime();
  const ratio = elapsedMs / totalMs;
  const pct = Math.round(ratio * 100);
  return Math.max(0, Math.min(100, pct));
}

function networkGradientClass(networks: string[]): string {
  const primary = (networks[0] || '').toLowerCase();

  if (primary === 'tiktok') {
    return 'from-[#25F4EE]/15 to-[#FE2C55]/15';
  }
  if (primary === 'instagram') {
    return 'from-[#F58529]/15 to-[#DD2A7B]/15';
  }
  if (primary === 'youtube') {
    return 'from-[#FF0000]/15 via-[var(--surface-2)] to-transparent';
  }

  return 'from-[var(--accent)]/8 to-[var(--surface-3)]';
}

export default async function BrandContestsPage() {
  const { user } = await getSession();
  if (!user) return null;

  const { contests, stats } = await fetchBrandContests(user.id);

  const now = new Date();

  const liveContests = contests.filter((c) => c.status === 'active');
  const reviewingContests = contests.filter((c) => c.status === 'reviewing');
  const pendingContests = contests.filter((c) => c.status === 'pending_live');
  const draftContests = contests.filter((c) => c.status === 'draft');
  const endedContests = contests.filter((c) => c.status === 'ended' || c.status === 'archived');

  const total = contests.length;
  const hasNoContests = total === 0;

  return (
    <div className="mx-auto max-w-7xl px-4 lg:px-6 py-8 space-y-10">
      <TrackOnView
        event="view_brand_contests"
        payload={{ total, active: stats.active }}
      />

      {/* HEADER */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold brand-tracking text-[var(--text-1)]">
            Mes campagnes
          </h1>
          <p className="mt-1 text-sm text-[var(--text-3)]">
            {total} campagne{total > 1 ? 's' : ''} · {stats.active} active{stats.active > 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/app/brand/contests/new" className={ctaClass}>
          <Plus className="h-4 w-4" />
          Nouvelle campagne
        </Link>
      </header>

      {hasNoContests ? (
        <BrandEmptyState
          type="no-contests"
          title="Prêt à lancer ton premier concours ?"
          description="Crée un concours UGC en quelques minutes et génère du contenu de qualité pour ta marque."
          action={{
            label: 'Créer un concours',
            href: '/app/brand/contests/new',
            variant: 'primary',
          }}
        />
      ) : (
        <>
          {/* SECTION LIVE */}
          <ContestSection
            title="● En cours"
            titleClass="text-[var(--accent)]"
            dot
            contests={liveContests}
            now={now}
          />

          {/* SECTION REVIEWING */}
          <ContestSection
            title="⏱ En révision"
            titleClass="text-[var(--brand-warning)]"
            contests={reviewingContests}
            now={now}
          />

          {/* SECTION PENDING LIVE */}
          <ContestSection
            title="🕐 En attente de lancement"
            contests={pendingContests}
            now={now}
          />

          {/* SECTION DRAFTS */}
          <ContestSection
            title="Brouillons"
            contests={draftContests}
            muted
            now={now}
          />

          {/* SECTION ENDED / ARCHIVED */}
          {endedContests.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-[var(--text-2)]">
                  Terminés
                </h2>
                {endedContests.length > 3 && (
                  <span className="text-xs text-[var(--text-3)] tabular-nums">
                    {endedContests.length} campagne{endedContests.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {endedContests.length > 3 ? (
                <CollapsibleSection
                  defaultCollapsed
                  initialVisibleCount={3}
                  totalCount={endedContests.length}
                >
                  {(visibleCount) => (
                    <div className="space-y-3">
                      {endedContests.slice(0, visibleCount).map((contest, index) => (
                        <ContestCard
                          key={contest.id}
                          contest={contest}
                          now={now}
                          muted
                          index={index}
                        />
                      ))}
                    </div>
                  )}
                </CollapsibleSection>
              ) : (
                <div className="space-y-3">
                  {endedContests.map((contest, index) => (
                    <ContestCard
                      key={contest.id}
                      contest={contest}
                      now={now}
                      muted
                      index={index}
                    />
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function ContestSection({
  title,
  titleClass,
  dot = false,
  contests,
  muted = false,
  now,
}: {
  title: string;
  titleClass?: string;
  dot?: boolean;
  contests: CampaignRow[];
  muted?: boolean;
  now: Date;
}) {
  if (contests.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        {dot && (
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] motion-safe:animate-pulse" aria-hidden="true" />
        )}
        <h2 className={cn('text-sm font-semibold text-[var(--text-2)]', titleClass)}>
          {title}
        </h2>
      </div>
      <div className="space-y-3">
        {contests.map((contest, index) => (
          <ContestCard
            key={contest.id}
            contest={contest}
            now={now}
            muted={muted}
            index={index}
          />
        ))}
      </div>
    </section>
  );
}

function ContestCard({
  contest,
  now,
  muted,
  index,
}: {
  contest: CampaignRow;
  now: Date;
  muted?: boolean;
  index: number;
}) {
  const isActive = contest.status === 'active';
  const isDraft = contest.status === 'draft';
  const isEnded = contest.status === 'ended' || contest.status === 'archived';

  const progressPct = isActive
    ? computeProgressPct(contest.start_at, contest.end_at, now)
    : 0;

  const gradient = networkGradientClass(contest.networks || []);

  const createdLabel = formatDate(contest.created_at);

  let timelineLabel = createdLabel;
  if (isActive && contest.start_at && contest.end_at) {
    const end = new Date(contest.end_at);
    const diffDays = Math.max(
      0,
      Math.round((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
    );
    timelineLabel = diffDays > 0 ? `J-${diffDays} restants` : 'Terminé';
  }

  return (
    <div
      className={cn(
        'group relative rounded-[var(--r3)] border border-[var(--border-1)]',
        'bg-[var(--surface-1)]/80 backdrop-blur-xl overflow-hidden',
        'transition-all duration-200 hover:border-[var(--border-2)] hover:shadow-[var(--shadow-brand-2)]',
        'motion-safe:hover:-translate-y-px',
        muted && 'opacity-90',
        'motion-safe:opacity-100',
      )}
      style={{
        animationDelay: `${index * 50}ms`,
        opacity: 1, // évite flash si animate-fadeIn absent
      }}
    >
      <div className="flex gap-0">
        {/* LEFT — Gradient visual */}
        <div
          className={cn(
            'relative w-[200px] shrink-0 self-stretch min-h-[120px]',
            'bg-gradient-to-br',
            gradient,
          )}
        >
          {/* Status overlay */}
          <div className="absolute top-3 left-3">
            <StatusBadge
              variant={
                contest.status === 'active'
                  ? 'success'
                  : contest.status === 'draft'
                    ? 'neutral'
                    : contest.status === 'archived'
                      ? 'muted'
                      : 'warning'
              }
              label={
                contest.status === 'active' ? 'Live' :
                contest.status === 'draft' ? 'Brouillon' :
                contest.status === 'pending_live' ? 'Bientôt live' :
                contest.status === 'reviewing' ? 'En révision' :
                contest.status === 'ended' ? 'Terminé' :
                contest.status === 'archived' ? 'Archivé' :
                contest.status === 'paused' ? 'En pause' :
                contest.status
              }
              pulse={isActive}
            />
          </div>

          {/* Track pattern overlay */}
          <div className="absolute inset-0 track-pattern opacity-30" aria-hidden="true" />
        </div>

        {/* RIGHT — Content */}
        <div className="flex flex-1 flex-col justify-between p-5 min-w-0">
          {/* TOP: Title + date */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-[var(--text-1)] truncate brand-tracking">
                {contest.title}
              </h3>
              <p className="text-xs text-[var(--text-3)] mt-0.5">
                {timelineLabel}
              </p>
            </div>
          </div>

          {/* MIDDLE: KPIs */}
          <div className="flex items-center gap-6 my-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-[var(--text-3)]">
                Vues
              </p>
              <p className="text-sm font-semibold tabular-nums text-[var(--text-1)]">
                {formatViews(contest.views)}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-[var(--text-3)]">
                Créateurs
              </p>
              <p className="text-sm font-semibold tabular-nums text-[var(--text-1)]">
                {contest.submissions_count}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-[var(--text-3)]">
                Budget
              </p>
              <p className="text-sm font-semibold tabular-nums text-[var(--text-1)]">
                {formatCurrency(contest.prize_pool_cents, contest.currency)}
              </p>
            </div>
            {isActive && (
              <div className="flex-1 max-w-[140px]">
                <p className="text-[11px] uppercase tracking-wide text-[var(--text-3)] mb-1">
                  Progression
                </p>
                <div className="h-1 rounded-full bg-[var(--surface-2)] w-full">
                  <div
                    className="h-full rounded-full bg-[var(--accent)] motion-safe:transition-all"
                    style={{ width: `${progressPct}%` }}
                    aria-label={`Progression de la campagne à ${progressPct}%`}
                  />
                </div>
              </div>
            )}
          </div>

          {/* BOTTOM: Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {isActive && (
              <Link
                href={`/app/brand/contests/${contest.id}`}
                className="inline-flex items-center gap-1.5 rounded-[var(--r2)] border border-[var(--accent)]/20 bg-[var(--accent)]/10 px-3 py-1.5 text-xs font-medium text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/20"
              >
                <Trophy className="h-3.5 w-3.5" />
                Classement
              </Link>
            )}

            {contest.pending_submissions_count > 0 && (
              <Link
                href={`/app/brand/contests/${contest.id}/submissions?status=pending`}
                className="inline-flex items-center gap-1.5 rounded-[var(--r2)] border border-[var(--brand-warning)]/20 bg-[var(--brand-warning)]/10 px-3 py-1.5 text-xs font-medium text-[var(--brand-warning)] transition-colors hover:bg-[var(--brand-warning)]/20"
              >
                <Zap className="h-3.5 w-3.5" />
                Modérer {contest.pending_submissions_count}
              </Link>
            )}

            {isDraft && (
              <Link
                href={`/app/brand/contests/${contest.id}/edit`}
                className={secondarySmallClass}
              >
                Continuer →
              </Link>
            )}

            {isEnded && (
              <Link
                href={`/app/brand/contests/${contest.id}`}
                className={secondarySmallClass}
              >
                Voir résultats
              </Link>
            )}

            <Link
              href={`/app/brand/contests/${contest.id}`}
              className="ml-auto text-xs text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors"
            >
              Détails →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Data fetching (server only) ─── */

async function fetchBrandContests(
  userId: string,
): Promise<{
  contests: CampaignRow[];
  stats: {
    active: number;
    draft: number;
    ended: number;
    pending: number;
    reviewing: number;
  };
}> {
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
    return {
      contests: [],
      stats: { active: 0, draft: 0, ended: 0, pending: 0, reviewing: 0 },
    };
  }

  // 2. Stats depuis les données déjà chargées (zéro requête extra)
  const stats = {
    active: contests.filter((c) => c.status === 'active').length,
    draft: contests.filter((c) => c.status === 'draft').length,
    ended: contests.filter((c) => c.status === 'ended' || c.status === 'archived').length,
    pending: contests.filter((c) => c.status === 'pending_live').length,
    reviewing: contests.filter((c) => c.status === 'reviewing').length,
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
