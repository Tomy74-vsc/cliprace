/*
Page: Brand contest detail
Objectifs: statistiques, UGC (submissions), leaderboard, actions (modifier, dupliquer, promouvoir)
*/
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { BrandEmptyState } from '@/components/brand/empty-state-enhanced';
import { formatCurrency, formatDate } from '@/lib/formatters';
import {
  Edit,
  ExternalLink,
  Eye,
  TrendingUp,
  DollarSign,
  FileText,
  Share2,
  MessageSquare,
  Download,
  PlayCircle,
} from 'lucide-react';
import { TrackOnView } from '@/components/analytics/track-once';
import { PlatformBadge } from '@/components/creator/platform-badge';
import { ContestMetricsChart } from '@/components/brand/contest-metrics-chart';
import { ExportCSVButton } from '@/components/brand/export-csv-button';
import { DuplicateContestButton } from '@/components/brand/duplicate-contest-button';
import {
  GlassCard,
  StatusBadge,
  contestStatusVariant,
  contestStatusLabel,
} from '@/components/brand-ui';
import type { Platform } from '@/lib/validators/platforms';

export const revalidate = 60;

export default async function BrandContestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await getSession();
  if (!user) return null;

  const { id } = await params;
  const { contest, metrics, submissions, leaderboard, error } = await fetchContestData(id, user.id);

  if (error || !contest) {
    return (
      <main className="space-y-6">
        <BrandEmptyState
          type="no-results"
          title="Concours introuvable"
          description="Ce concours n'existe plus ou tu n'as pas les droits pour y accéder."
          action={{ label: 'Retour aux concours', href: '/app/brand/contests', variant: 'secondary' }}
        />
      </main>
    );
  }

  const isDraft = contest.status === 'draft';
  const isActive = contest.status === 'active';
  const isEnded = contest.status === 'ended' || contest.status === 'archived';
  const isProductContest = contest.contest_type === 'product';
  const cpv = !isProductContest && metrics.total_views > 0
    ? Math.round((contest.prize_pool_cents / metrics.total_views) * 1000)
    : 0;

  return (
    <main className="space-y-8">
      <TrackOnView event="view_brand_contest_detail" payload={{ contest_id: id, status: contest.status }} />

      {/* En-tête */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-1)]">
              {contest.title}
            </h1>
            <StatusBadge
              variant={contestStatusVariant(contest.status)}
              label={contestStatusLabel(contest.status)}
              pulse={contest.status === 'active'}
            />
          </div>
          <p className="text-sm text-[var(--text-2)]">
            {contest.start_at && formatDate(contest.start_at)} ? {formatDate(contest.end_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isDraft && (
            <Link
              href={`/app/brand/contests/${id}/edit`}
              className="inline-flex items-center gap-2 rounded-[var(--r2)] bg-[var(--cta-bg)] px-4 py-2.5 text-sm font-medium text-[var(--cta-fg)] transition-colors hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-void)]"
            >
              <Edit className="h-4 w-4" />
              Modifier
            </Link>
          )}
          <Link
            href={`/contests/${id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-[var(--r2)] border border-[var(--border-1)] px-4 py-2.5 text-sm font-medium text-[var(--text-2)] transition-colors hover:border-[var(--border-2)] hover:text-[var(--text-1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            <ExternalLink className="h-4 w-4" />
            Voir page publique
          </Link>
          <DuplicateContestButton contestId={id} />
          <ExportCSVButton contestId={id} contestTitle={contest.title} />
        </div>
      </div>

      {/* Statistiques */}
      <section>
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-[var(--r3)] border border-[var(--border-1)] bg-[var(--surface-1)]/80 p-5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-3)]">
                Vues totales
              </p>
              <Eye className="h-4 w-4 text-[var(--text-3)]" aria-hidden="true" />
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--text-1)]">
              {metrics.total_views.toLocaleString('fr-FR')}
            </p>
            <p className="mt-1 text-xs text-[var(--text-3)]">
              Toutes soumissions confondues
            </p>
          </div>

          <div className="rounded-[var(--r3)] border border-[var(--border-1)] bg-[var(--surface-1)]/80 p-5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-3)]">
                Engagement
              </p>
              <TrendingUp className="h-4 w-4 text-[var(--text-3)]" aria-hidden="true" />
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--text-1)]">
              {metrics.total_likes.toLocaleString('fr-FR')}
            </p>
            <p className="mt-1 text-xs text-[var(--text-3)]">Likes total</p>
          </div>

          <div className="rounded-[var(--r3)] border border-[var(--border-1)] bg-[var(--surface-1)]/80 p-5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-3)]">
                CPV
              </p>
              <DollarSign className="h-4 w-4 text-[var(--text-3)]" aria-hidden="true" />
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--text-1)]">
              {cpv > 0 ? formatCurrency(cpv, contest.currency) : '-'}
            </p>
            <p className="mt-1 text-xs text-[var(--text-3)]">
              {isProductContest
                ? 'Non applicable pour les concours produit'
                : 'Coût pour 1000 vues'}
            </p>
          </div>

          <div className="rounded-[var(--r3)] border border-[var(--border-1)] bg-[var(--surface-1)]/80 p-5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-3)]">
                Soumissions
              </p>
              <FileText className="h-4 w-4 text-[var(--text-3)]" aria-hidden="true" />
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--text-1)]">
              {String(metrics.approved_submissions)}
            </p>
            <p className="mt-1 text-xs text-[var(--text-3)]">
              {`${submissions.pending} en attente`}
            </p>
          </div>
        </div>
      </section>

      {/* Graphique croissance journalière */}
      <GlassCard className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-1)]">
            Croissance journalière
          </h2>
          <p className="mt-1 text-xs text-[var(--text-3)]">
            Évolution des vues quotidiennes depuis le début du concours
          </p>
        </div>
        <div className="h-[220px]">
          <ContestMetricsChart data={metrics.daily_views} />
        </div>
      </GlassCard>

      {/* UGC (Submissions) */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-1)]">
              Soumissions
            </h2>
            <p className="mt-1 text-sm text-[var(--text-2)]">
              {submissions.pending > 0 && (
                <span className="font-medium text-[var(--brand-warning)]">
                  {submissions.pending} en attente de modération
                </span>
              )}
              {submissions.pending === 0 &&
                'Toutes les soumissions sont modérées'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/app/brand/contests/${id}/submissions`}
              className="inline-flex items-center gap-2 rounded-[var(--r2)] border border-[var(--border-1)] px-3 py-2 text-sm font-medium text-[var(--text-2)] transition-colors hover:border-[var(--border-2)] hover:text-[var(--text-1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              <FileText className="h-4 w-4" />
              Voir toutes les soumissions
            </Link>
            <Link
              href={`/app/brand/contests/${id}/submissions?status=pending&focus=1`}
              className="inline-flex items-center gap-2 rounded-[var(--r2)] border border-[var(--accent)]/30 bg-[var(--accent)]/8 px-3 py-2 text-sm font-medium text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              <PlayCircle className="h-4 w-4" />
              Lancer le Focus Mode
            </Link>
          </div>
        </div>

        {submissions.recent.length === 0 ? (
          <GlassCard>
            <BrandEmptyState
              type="no-submissions"
              title="Aucune soumission"
              description="Les créateurs n'ont pas encore participé à ce concours."
              action={{
                label: 'Promouvoir le concours',
                href: '#',
                variant: 'secondary',
              }}
            />
          </GlassCard>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {submissions.recent.map((submission) => (
              <SubmissionCard key={submission.id} submission={submission} contestId={id} />
            ))}
          </div>
        )}
      </section>

      {/* Leaderboard */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-1)]">
              Classement
            </h2>
            <p className="mt-1 text-sm text-[var(--text-2)]">
              Top créateurs par vues pondérées
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/app/brand/contests/${id}/leaderboard`}
              className="inline-flex items-center gap-2 rounded-[var(--r2)] border border-[var(--border-1)] px-3 py-2 text-xs font-medium text-[var(--text-2)] transition-colors hover:border-[var(--border-2)] hover:text-[var(--text-1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              Voir le classement complet
            </Link>
            <a
              href={`/api/contests/${id}/export-pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-[var(--r2)] border border-[var(--border-1)] px-3 py-2 text-xs font-medium text-[var(--text-2)] transition-colors hover:border-[var(--border-2)] hover:text-[var(--text-1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              <Download className="h-4 w-4" />
              Export PDF
            </a>
          </div>
        </div>

        {leaderboard.length === 0 ? (
          <GlassCard className="pt-6">
            <p className="text-center text-sm text-[var(--text-2)]">
              Aucun classement disponible pour le moment.
            </p>
          </GlassCard>
        ) : (
          <GlassCard className="p-0 overflow-hidden">
            <div className="divide-y divide-[var(--border-1)]">
              {leaderboard
                .slice(0, 10)
                .map(
                  (entry: {
                    creator_id: string;
                    creator_name: string | null;
                    total_views: number;
                    total_likes: number;
                    estimated_payout_cents: number;
                  }, index: number) => (
                    <div
                      key={entry.creator_id}
                      className="flex items-center justify-between p-4 transition-colors hover:bg-[var(--surface-2)]/40"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)]/10 text-xs font-semibold text-[var(--accent)]">
                          {index + 1}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[var(--text-1)]">
                            {entry.creator_name || 'Créateur anonyme'}
                          </p>
                          <p className="text-xs text-[var(--text-3)]">
                            {entry.total_views.toLocaleString('fr-FR')} vues ⬢{' '}
                            {entry.total_likes.toLocaleString('fr-FR')} likes
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-[var(--text-1)]">
                          {formatCurrency(
                            entry.estimated_payout_cents,
                            contest.currency,
                          )}
                        </p>
                        <p className="text-xs text-[var(--text-3)]">
                          Gain estimé
                        </p>
                      </div>
                    </div>
                  ),
                )}
            </div>
          </GlassCard>
        )}
      </section>

      {/* CTA */}
      <section className="grid gap-4 md:grid-cols-2">
        <GlassCard className="space-y-4" pattern="track">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-1)]">
            <Share2 className="h-4 w-4 text-[var(--accent)]" />
            Promouvoir le concours
          </h3>
          <p className="text-xs text-[var(--text-3)]">
            Partage le concours sur tes réseaux pour attirer plus de créateurs.
          </p>
          <button
            type="button"
            disabled
            className="mt-4 w-full cursor-not-allowed rounded-[var(--r2)] border border-[var(--border-1)] px-4 py-2.5 text-sm font-medium text-[var(--text-3)] opacity-50"
          >
            Générer le lien de partage
          </button>
        </GlassCard>

        <GlassCard className="space-y-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-1)]">
            <MessageSquare className="h-4 w-4 text-[var(--accent)]" />
            Contacter les participants
          </h3>
          <p className="text-xs text-[var(--text-3)]">
            Envoie un message à tous les créateurs qui ont participé.
          </p>
          <button
            type="button"
            disabled
            className="mt-4 w-full cursor-not-allowed rounded-[var(--r2)] border border-[var(--border-1)] px-4 py-2.5 text-sm font-medium text-[var(--text-3)] opacity-50"
          >
            Envoyer un message
          </button>
        </GlassCard>
      </section>
    </main>
  );
}

interface SubmissionCardProps {
  submission: {
    id: string;
    external_url: string;
    platform: string;
    status: string;
    creator_name: string | null;
    views: number;
    likes: number;
  };
  contestId: string;
}

function SubmissionCard({ submission, contestId }: SubmissionCardProps) {
  return (
    <div className="group rounded-[var(--r3)] border border-[var(--border-1)] bg-[var(--surface-1)]/80 p-4 transition-all motion-safe:hover:-translate-y-px motion-safe:hover:shadow-[var(--shadow-brand-2)] hover:border-[var(--border-2)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="line-clamp-1 text-sm font-medium text-[var(--text-1)]">
            {submission.creator_name || 'Créateur'}
          </p>
          <PlatformBadge
            platform={submission.platform as Platform}
            className="mt-1"
          />
        </div>
        <StatusBadge
          variant={
            submission.status === 'approved'
              ? 'success'
              : submission.status === 'rejected'
                ? 'danger'
                : 'warning'
          }
          label={
            submission.status === 'approved'
              ? 'Approuvé'
              : submission.status === 'rejected'
                ? 'Refusé'
                : 'En attente'
          }
        />
      </div>
      <div className="mt-3 space-y-3 text-sm">
        <a
          href={submission.external_url}
          target="_blank"
          rel="noopener noreferrer"
          className="line-clamp-1 text-sm text-[var(--accent)] underline-offset-2 transition-colors hover:underline"
        >
          {submission.external_url}
        </a>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-xs text-[var(--text-3)]">Vues</p>
            <p className="text-sm font-semibold text-[var(--text-1)]">
              {submission.views.toLocaleString('fr-FR')}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-3)]">Likes</p>
            <p className="text-sm font-semibold text-[var(--text-1)]">
              {submission.likes.toLocaleString('fr-FR')}
            </p>
          </div>
        </div>
        <Link
          href={`/app/brand/contests/${contestId}/submissions?submission=${submission.id}`}
          className="mt-1 inline-flex w-full items-center justify-center rounded-[var(--r2)] border border-[var(--border-1)] px-3 py-2 text-xs font-medium text-[var(--text-2)] transition-colors hover:border-[var(--border-2)] hover:text-[var(--text-1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          {submission.status === 'pending' ? 'Modérer' : 'Voir détails'}
        </Link>
      </div>
    </div>
  );
}

async function fetchContestData(contestId: string, userId: string) {
  const supabase = await getSupabaseSSR();

  // VAGUE 0 — contest seul (ownership check — bloquant par design)
  const { data: contest, error: contestError } = await supabase
    .from('contests')
    .select(
      'id, title, brief_md, cover_url, status, prize_pool_cents, currency, start_at, end_at, networks, brand_id, contest_type, product_details, platform_fee'
    )
    .eq('id', contestId)
    .eq('brand_id', userId)
    .maybeSingle();

  if (contestError || !contest) {
    return { error: 'Contest not found', contest: null, metrics: null, submissions: null, leaderboard: null };
  }

  // VAGUE 1 — tout ce qui dépend uniquement de contestId
  const [
    submissionsResult,
    metricsResult,
    recentSubmissionsResult,
    pendingCountResult,
    leaderboardResult,
    prizesResult,
  ] = await Promise.all([
    supabase.from('submissions').select('id').eq('contest_id', contestId),
    supabase.rpc('get_contest_metrics', { p_contest_id: contestId }),
    supabase
      .from('submissions')
      .select(
        'id, external_url, platform, status, creator_id, submitted_at, creator:creator_id(display_name)'
      )
      .eq('contest_id', contestId)
      .order('submitted_at', { ascending: false })
      .limit(6),
    supabase
      .from('submissions')
      .select('id', { count: 'exact', head: true })
      .eq('contest_id', contestId)
      .eq('status', 'pending'),
    supabase.rpc('get_contest_leaderboard', { p_contest_id: contestId, p_limit: 30 }),
    supabase
      .from('contest_prizes')
      .select('position, amount_cents, percentage')
      .eq('contest_id', contestId)
      .order('position', { ascending: true }),
  ]);

  // VAGUE 2 — dépend des IDs obtenus en vague 1
  const allSubmissionIds = submissionsResult.data?.map((s) => s.id) || [];
  const submissionsData = recentSubmissionsResult.data || [];
  const recentSubmissionIds = submissionsData.map((s) => s.id);
  const leaderboardData = leaderboardResult.data || [];
  const creatorIds = leaderboardData.map((l: { creator_id: string }) => l.creator_id);
  const prizes = prizesResult.data || [];

  const [
    dailyMetricsResult,
    recentMetricsResult,
    creatorsResult,
  ] = await Promise.all([
    allSubmissionIds.length > 0
      ? supabase
          .from('metrics_daily')
          .select('metric_date, views')
          .in('submission_id', allSubmissionIds)
          .order('metric_date', { ascending: true })
      : Promise.resolve({ data: [] }),
    recentSubmissionIds.length > 0
      ? supabase
          .from('metrics_daily')
          .select('submission_id, views:sum(views), likes:sum(likes)')
          .in('submission_id', recentSubmissionIds)
      : Promise.resolve({ data: [] }),
    creatorIds.length > 0
      ? supabase.from('profiles').select('id, display_name').in('id', creatorIds)
      : Promise.resolve({ data: [] }),
  ]);

  // VAGUE 3 — assemblage JS pur (zéro DB)
  const dailyMetrics = dailyMetricsResult.data || [];
  const dailyViews: Array<{ date: string; views: number }> = [];
  const viewsByDate = new Map<string, number>();
  dailyMetrics.forEach((m: { metric_date: string; views: number }) => {
    const date = m.metric_date;
    const current = viewsByDate.get(date) || 0;
    viewsByDate.set(date, current + (m.views || 0));
  });
  viewsByDate.forEach((views, date) => {
    dailyViews.push({ date, views });
  });
  dailyViews.sort((a, b) => a.date.localeCompare(b.date));

  const metricsData = metricsResult.data;
  const metrics =
    metricsData && metricsData.length > 0
      ? {
          total_views: Number(metricsData[0].total_views || 0),
          total_likes: Number(metricsData[0].total_likes || 0),
          total_submissions: Number(metricsData[0].total_submissions || 0),
          approved_submissions: Number(metricsData[0].approved_submissions || 0),
          daily_views: dailyViews,
        }
      : {
          total_views: 0,
          total_likes: 0,
          total_submissions: 0,
          approved_submissions: 0,
          daily_views: dailyViews,
        };

  const metricsRows = recentMetricsResult.data || [];
  const metricsBySubmission = new Map<string, { views: number; likes: number }>();
  metricsRows.forEach((row: UnsafeAny) => {
    const viewsValue = Array.isArray(row.views)
      ? Number((row.views[0] as UnsafeAny)?.views || 0)
      : Number(row.views || 0);
    const likesValue = Array.isArray(row.likes)
      ? Number((row.likes[0] as UnsafeAny)?.likes || 0)
      : Number(row.likes || 0);
    metricsBySubmission.set(String(row.submission_id), {
      views: viewsValue,
      likes: likesValue,
    });
  });

  const submissionsWithMetrics = submissionsData.map((submission) => {
    const metricsForSub = metricsBySubmission.get(submission.id) || { views: 0, likes: 0 };
    return {
      id: submission.id,
      external_url: submission.external_url,
      platform: submission.platform,
      status: submission.status,
      creator_name: (submission.creator as { display_name?: string | null } | null)?.display_name || null,
      views: metricsForSub.views,
      likes: metricsForSub.likes,
    };
  });

  const creators = creatorsResult.data || [];
  const creatorMap = new Map(creators.map((c) => [c.id, c.display_name || null]));

  const leaderboard = leaderboardData.map((entry: UnsafeAny, index: number) => {
    const rank = index + 1;
    const prize = prizes.find((p: { position: number }) => p.position === rank);
    const estimatedPayout = prize
      ? prize.amount_cents || Math.round((contest.prize_pool_cents * (prize.percentage || 0)) / 100)
      : 0;

    return {
      creator_id: entry.creator_id,
      creator_name: creatorMap.get(entry.creator_id) || null,
      rank,
      total_weighted_views: Number(entry.total_weighted_views || 0),
      total_views: Number(entry.total_views || 0),
      total_likes: Number(entry.total_likes || 0),
      estimated_payout_cents: estimatedPayout,
    };
  });

  const pendingCount = pendingCountResult.count ?? 0;

  return {
    contest,
    metrics,
    submissions: {
      recent: submissionsWithMetrics,
      pending: pendingCount,
    },
    leaderboard,
    error: null,
  };
}
