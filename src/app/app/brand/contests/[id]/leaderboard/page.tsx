import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { fetchContestLeaderboard } from '@/lib/queries/contest-leaderboard';
import { BrandEmptyState } from '@/components/brand/empty-state-enhanced';
import { formatCurrency } from '@/lib/formatters';
import { TrackOnView } from '@/components/analytics/track-once';
import { Info, Download, ArrowLeft, Trophy } from 'lucide-react';
import { GlassCard, StatusBadge } from '@/components/brand-ui';
import { LeaderboardPodium } from '@/components/brand/leaderboard-podium';
import { cn } from '@/lib/utils';

export const revalidate = 45;

type Mode = 'views' | 'score';

interface ContestLeaderboardPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function BrandContestLeaderboardPage({
  params,
  searchParams,
}: ContestLeaderboardPageProps) {
  const { user } = await getSession();
  if (!user) return null;

  const { id } = await params;
  const supabase = await getSupabaseSSR();
  const paramsObj = await searchParams;

  // Vérifier que le concours appartient à la marque
  const { data: contest, error } = await supabase
    .from('contests')
    .select('id, title, prize_pool_cents, currency, status, brand_id')
    .eq('id', id)
    .eq('brand_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('Contest leaderboard fetch error', error);
  }

  if (!contest) {
    notFound();
  }

  const modeParam = typeof paramsObj.mode === 'string' ? paramsObj.mode : 'views';
  const mode: Mode = modeParam === 'score' ? 'score' : 'views';

  const leaderboard = await fetchContestLeaderboard(contest.id, 50);

  // Récupérer les prix pour calculer les gains estimés
  const { data: prizes } = await supabase
    .from('contest_prizes')
    .select('position, amount_cents, percentage')
    .eq('contest_id', contest.id)
    .order('position', { ascending: true });

  // Calculer les gains estimés pour chaque entrée
  const leaderboardWithPayouts = leaderboard.map((entry) => {
    const prize = prizes?.find((p) => p.position === entry.rank);
    const estimatedPayout = prize
      ? prize.amount_cents || Math.round((contest.prize_pool_cents * (prize.percentage || 0)) / 100)
      : 0;
    return {
      ...entry,
      estimated_payout_cents: estimatedPayout,
    };
  });

  const now = new Date();
  const lastUpdated = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const baseUrl = `/app/brand/contests/${contest.id}/leaderboard`;
  const viewsHref = `${baseUrl}?mode=views`;
  const scoreHref = `${baseUrl}?mode=score`;
  const refreshHref = `${baseUrl}?mode=${mode}&ts=${now.getTime()}`;

  return (
    <main className="mx-auto max-w-5xl px-4 lg:px-6 py-8 space-y-8">
      <TrackOnView
        event="view_brand_leaderboard"
        payload={{
          contest_id: contest.id,
          entries: leaderboard.length,
          mode,
        }}
      />

      {/* ── HEADER ── */}
      <div className="space-y-4">
        {/* Breadcrumb */}
        <Link
          href={`/app/brand/contests/${contest.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-3)]
            hover:text-[var(--text-2)] transition-colors
            focus-visible:outline-none focus-visible:ring-2
            focus-visible:ring-[var(--accent)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Retour au concours
        </Link>

        {/* Title row */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold brand-tracking text-[var(--text-1)]">
                Classement
              </h1>
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
                label={contest.status === 'active' ? 'Live' : contest.status}
                pulse={contest.status === 'active'}
              />
            </div>
            <p className="mt-1 text-sm text-[var(--text-3)]">
              {contest.title} · Prize pool{' '}
              <span className="font-semibold text-[var(--text-2)]">
                {formatCurrency(contest.prize_pool_cents, contest.currency || 'EUR')}
              </span>
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <span className="text-xs text-[var(--text-3)]">
              Mis à jour à {lastUpdated}
            </span>
            <Link
              href={refreshHref}
              className="inline-flex items-center gap-1.5 rounded-[var(--r2)]
                border border-[var(--border-1)] px-3 py-1.5 text-xs font-medium
                text-[var(--text-2)] transition-colors hover:border-[var(--border-2)]
                hover:text-[var(--text-1)]"
            >
              Rafraîchir
            </Link>
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-1.5 rounded-[var(--r2)]
                border border-[var(--border-1)] px-3 py-1.5 text-xs font-medium
                text-[var(--text-3)] opacity-50 cursor-not-allowed"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Mode toggle */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-[var(--text-3)]">Classement par :</span>
          <div className="inline-flex rounded-[var(--r-pill)] border border-[var(--border-1)]
            bg-[var(--surface-2)]/50 p-0.5">
            <Link
              href={viewsHref}
              className={cn(
                'px-3 py-1 rounded-[var(--r-pill)] text-xs font-medium transition-colors',
                mode === 'views'
                  ? 'bg-[var(--surface-1)] text-[var(--text-1)] shadow-sm'
                  : 'text-[var(--text-3)] hover:text-[var(--text-2)]',
              )}
            >
              Vues
            </Link>
            <Link
              href={scoreHref}
              className={cn(
                'px-3 py-1 rounded-[var(--r-pill)] text-xs font-medium transition-colors',
                mode === 'score'
                  ? 'bg-[var(--surface-1)] text-[var(--text-1)] shadow-sm'
                  : 'text-[var(--text-3)] hover:text-[var(--text-2)]',
              )}
            >
              Score pondéré
            </Link>
          </div>

          <p className="text-xs text-[var(--text-3)] max-w-md">
            <span className="font-medium text-[var(--text-2)]">Score pondéré</span> : vues ajustées selon réseau,
            engagement et qualité du trafic.
          </p>
        </div>
      </div>

      {/* ── CONTENU ── */}
      {leaderboardWithPayouts.length === 0 ? (
        <GlassCard className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-12 w-12 rounded-full bg-[var(--surface-2)] flex items-center justify-center mb-4">
            <Trophy className="h-6 w-6 text-[var(--text-3)]" strokeWidth={1.5} />
          </div>
          <h2 className="text-base font-semibold text-[var(--text-1)]">
            Classement vide pour l&apos;instant
          </h2>
          <p className="mt-2 text-sm text-[var(--text-3)] max-w-sm">
            Aucune participation visible. Revenez après les premières soumissions.
          </p>
          <Link
            href={`/app/brand/contests/${contest.id}`}
            className="mt-6 inline-flex items-center gap-2 rounded-[var(--r2)]
              border border-[var(--border-1)] px-4 py-2 text-sm font-medium
              text-[var(--text-2)] hover:border-[var(--border-2)]
              hover:text-[var(--text-1)] transition-colors"
          >
            Voir le concours
          </Link>
        </GlassCard>
      ) : (
        <>
          {/* ── PODIUM CLIENT ISLAND ── */}
          <LeaderboardPodium
            entries={leaderboardWithPayouts.slice(0, 3)}
            currency={contest.currency || 'EUR'}
            mode={mode}
          />

          {/* ── TABLE COMPLÈTE (#4 → fin) ── */}
          {leaderboardWithPayouts.length > 3 && (
            <GlassCard className="p-0 overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--border-1)]">
                <h2 className="text-sm font-semibold text-[var(--text-1)]">
                  Classement complet
                </h2>
              </div>

              <div className="divide-y divide-[var(--border-1)]">
                {leaderboardWithPayouts.slice(3).map((entry, idx) => (
                  <div
                    key={`${entry.creator_id}-${entry.rank}`}
                    className="flex items-center gap-4 px-5 py-3.5
                      transition-colors hover:bg-[var(--surface-2)]/40"
                    style={{ animationDelay: `${idx * 30}ms` }}
                  >
                    {/* Rank */}
                    <div className="w-8 shrink-0 text-right">
                      <span className="text-sm font-semibold tabular-nums text-[var(--text-3)]">
                        #{entry.rank}
                      </span>
                    </div>

                    {/* Avatar + name */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-[var(--surface-2)]
                        border border-[var(--border-1)] flex items-center justify-center
                        shrink-0 text-xs font-semibold text-[var(--text-3)]">
                        {(entry.creator_name?.[0] || '?').toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-[var(--text-1)] truncate">
                        {entry.creator_name}
                      </span>
                    </div>

                    {/* Vues */}
                    <div className="text-right shrink-0">
                      <p
                        className={cn(
                          'text-sm tabular-nums font-medium',
                          mode === 'views'
                            ? 'text-[var(--text-1)]'
                            : 'text-[var(--text-3)]',
                        )}
                      >
                        {entry.total_views.toLocaleString('fr-FR')}
                      </p>
                      <p className="text-[11px] text-[var(--text-3)]">vues</p>
                    </div>

                    {/* Score */}
                    <div className="hidden sm:block text-right shrink-0">
                      <p
                        className={cn(
                          'text-sm tabular-nums font-medium',
                          mode === 'score'
                            ? 'text-[var(--text-1)]'
                            : 'text-[var(--text-3)]',
                        )}
                      >
                        {entry.total_weighted_views.toLocaleString('fr-FR', {
                          maximumFractionDigits: 0,
                        })}
                      </p>
                      <p className="text-[11px] text-[var(--text-3)]">score</p>
                    </div>

                    {/* Prize */}
                    <div className="text-right shrink-0 w-20">
                      {entry.estimated_payout_cents > 0 ? (
                        <span className="text-sm font-semibold tabular-nums text-[var(--accent)]">
                          {formatCurrency(entry.estimated_payout_cents, contest.currency || 'EUR')}
                        </span>
                      ) : (
                        <span className="text-sm text-[var(--text-3)]">—</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="px-5 py-3 border-t border-[var(--border-1)]
                bg-[var(--surface-2)]/30">
                <p className="text-xs text-[var(--text-3)] flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 shrink-0" />
                  Seuls les Top 30 sont soumis à modération prioritaire. Les autres participations sont prises en
                  compte automatiquement.
                </p>
              </div>
            </GlassCard>
          )}
        </>
      )}
    </main>
  );
}

