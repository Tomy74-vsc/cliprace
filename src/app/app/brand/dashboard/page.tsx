/*
 * Page: Brand Dashboard — "Mission Control"
 * Server Component. Client islands: KpiHero, RoiPerformanceChart,
 * DashboardPendingSubmissionsCard, AnalyticsPeriodToggle.
 *
 * Data fetching: fetchDashboardData (Promise.all, RPC) — UNTOUCHED.
 * Effect budget: 1 beam (Hero), 1 track pattern (Analytics), 1 notch (Hero).
 */
import Link from 'next/link';
import {
  Plus, AlertCircle, Eye,
  Shield, Zap, Download, Inbox, Send,
} from 'lucide-react';
import { getSession } from '@/lib/auth';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { GlassCard } from '@/components/brand-ui/GlassCard';
import { KpiHero } from '@/components/brand-ui/KpiHero';
import { TrackOnView } from '@/components/analytics/track-once';
import { RoiPerformanceChart } from '@/components/brand/roi-performance-chart';
import { DashboardPendingSubmissionsCard } from '@/components/brand/dashboard-pending-submissions-card';
import { AnalyticsPeriodToggle } from './analytics-period-toggle';
import { MetricsFreshnessBanner } from '@/components/brand/metrics-freshness-banner';

export const revalidate = 60;

/* ── CTA class (Uber-style: white bg, dark fg) ── */
const ctaClass = cn(
  'inline-flex items-center gap-2 rounded-[var(--r2)] px-5 py-2.5',
  'bg-[var(--cta-bg)] text-[var(--cta-fg)]',
  'text-sm font-semibold',
  'hover:bg-white/90 transition-colors',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50',
  'focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-void)]',
);

/* ── Secondary button class ── */
const secondaryClass = cn(
  'inline-flex items-center gap-1.5 rounded-[var(--r2)] px-4 py-2',
  'border border-[var(--border-1)] text-[var(--text-2)]',
  'text-sm font-medium',
  'hover:text-[var(--text-1)] hover:border-[var(--border-2)] hover:bg-[var(--surface-2)]/30',
  'transition-colors',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)]',
);

/* ── Ghost button class (small, minimal) ── */
const ghostClass = cn(
  'inline-flex items-center gap-1 rounded-[var(--r2)] px-3 py-1.5',
  'text-xs font-medium text-[var(--text-2)]',
  'hover:text-[var(--text-1)] hover:bg-[var(--surface-2)]/40',
  'transition-colors',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)]',
);

/* ── Status badge helper ── */
function statusLabel(status: string) {
  switch (status) {
    case 'active': return 'Live';
    case 'draft': return 'Brouillon';
    case 'closed': return 'Terminé';
    default: return status;
  }
}

/* ── Trust chips data ── */
const trustChips = [
  { icon: Shield, label: 'Paiements sécurisés' },
  { icon: Zap, label: 'Temps réel' },
  { icon: Download, label: 'Export CSV' },
] as const;

/* ── Onboarding steps data ── */
const onboardingSteps = [
  {
    num: 1,
    icon: Plus,
    label: 'Créer un concours',
    desc: 'Définis ton brief, ton budget et tes critères.',
    href: '/app/brand/contests/new',
    cta: 'Commencer',
    primary: true,
  },
  {
    num: 2,
    icon: Send,
    label: 'Publier et partager',
    desc: 'Les créateurs soumettent du contenu vidéo.',
    href: '/app/brand/contests',
    cta: 'Mes concours',
    primary: false,
  },
  {
    num: 3,
    icon: Inbox,
    label: 'Valider les vidéos',
    desc: 'Modère le contenu reçu en temps réel.',
    href: '/app/brand/moderation',
    cta: 'Modération',
    primary: false,
  },
] as const;

/* ═══════════════════════════════════════════════════════════
   HERO ONBOARDING — Reusable section for empty states
   ═══════════════════════════════════════════════════════════ */
function HeroOnboarding({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="space-y-6">
      {/* Title + subtitle */}
      <div>
        <h2 className="text-lg font-semibold text-[var(--text-1)] brand-tracking">
          {title}
        </h2>
        <p className="mt-1 text-sm text-[var(--text-2)]">{subtitle}</p>
      </div>

      {/* Trust chips */}
      <div className="flex flex-wrap gap-2" aria-label="Fonctionnalités">
        {trustChips.map((chip) => {
          const Icon = chip.icon;
          return (
            <span
              key={chip.label}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-[var(--r-pill)] px-2.5 py-1',
                'text-[11px] font-medium text-[var(--text-3)]',
                'bg-[var(--surface-2)]/50 border border-[var(--border-1)]',
              )}
            >
              <Icon className="h-3 w-3" strokeWidth={1.5} />
              {chip.label}
            </span>
          );
        })}
      </div>

      {/* Onboarding steps */}
      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">
          Prochaines étapes
        </p>
        <div className="space-y-2">
          {onboardingSteps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.num}
                className={cn(
                  'flex items-center gap-3 rounded-[var(--r2)] p-3',
                  'bg-[var(--surface-2)]/20 border border-[var(--border-1)]/50',
                )}
              >
                {/* Step number */}
                <div
                  className={cn(
                    'flex items-center justify-center h-7 w-7 rounded-full shrink-0',
                    'text-xs font-semibold',
                    step.primary
                      ? 'bg-[var(--brand-accent)] text-[var(--cta-fg)]'
                      : 'bg-[var(--surface-2)] border border-[var(--border-1)] text-[var(--text-3)]',
                  )}
                  aria-hidden="true"
                >
                  {step.num}
                </div>

                {/* Label + description */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text-1)]">
                    {step.label}
                  </p>
                  <p className="text-xs text-[var(--text-3)] mt-0.5">
                    {step.desc}
                  </p>
                </div>

                {/* Ghost CTA */}
                <Link
                  href={step.href}
                  className={cn(
                    ghostClass,
                    'shrink-0',
                    step.primary && 'text-[var(--brand-accent)]',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
                  {step.cta}
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default async function BrandDashboard() {
  const { user } = await getSession();
  if (!user) return null;

  const { data, error } = await fetchDashboardData(user.id);

  /* ── Error state ── */
  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 lg:px-6 py-6">
        <GlassCard className="flex flex-col items-center justify-center py-16 text-center">
          <AlertCircle className="h-10 w-10 text-[var(--brand-danger)] mb-4" strokeWidth={1.5} />
          <h1 className="text-lg font-semibold text-[var(--text-1)]">Erreur de chargement</h1>
          <p className="mt-2 text-sm text-[var(--text-2)] max-w-md">
            Impossible de charger le dashboard. Réessaie ou contacte le support.
          </p>
          <Link
            href="/app/brand/dashboard"
            className={cn(secondaryClass, 'mt-6')}
          >
            Réessayer
          </Link>
        </GlassCard>
      </div>
    );
  }

  if (!data) return null;

  /* ── Empty state (no contests at all) — Onboarding Executive ── */
  const hasContests = data.recent_contests.length > 0 || data.active_contests.length > 0;
  if (!hasContests) {
    return (
      <div className="mx-auto max-w-7xl px-4 lg:px-6 py-6 space-y-6">
        <TrackOnView event="view_brand_dashboard" payload={{ role: 'brand' }} />

        <header>
          <h1 className="text-2xl font-semibold brand-tracking text-[var(--text-1)]">
            {data.profileBrand?.company_name || 'Dashboard'}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-3)]">
            Bienvenue sur ClipRace — lance ta première campagne UGC.
          </p>
        </header>

        <GlassCard effect="beam" notched>
          <HeroOnboarding
            title="Lance ta première campagne"
            subtitle="Crée un concours UGC en quelques minutes et génère du contenu authentique pour ta marque."
          />
        </GlassCard>
      </div>
    );
  }

  /* ── Derived data ── */
  const roiChartData = data.daily_views.map((day) => ({
    date: day.date,
    label: new Date(day.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
    views: day.views,
    budget_cents: Math.round(data.stats.budget_spent_cents / Math.max(1, data.daily_views.length)),
  }));

  const cpv =
    data.stats.total_views > 0
      ? Math.round((data.stats.budget_spent_cents / data.stats.total_views) * 1000)
      : 0;

  const topPlatformEntry = Object.entries(data.platform_distribution)
    .sort(([, a], [, b]) => b - a)[0];
  const topPlatform = topPlatformEntry ? topPlatformEntry[0] : null;

  const budgetRemaining = data.stats.budget_engaged_cents - data.stats.budget_spent_cents;
  const budgetRemainingPct = data.stats.budget_engaged_cents > 0
    ? Math.max(0, Math.min(100, Math.round((budgetRemaining / data.stats.budget_engaged_cents) * 100)))
    : 100;

  /* Primary campaign: first active, or null */
  const primaryCampaign = data.active_contests[0] || null;

  /* Best performing contest (by views) */
  const bestContest = [...data.active_contests].sort((a, b) => b.views - a.views)[0] || null;
  const hasRealMetrics = data.stats.total_views > 0;
  const approvedSubmissionsCount = Object.values(data.platform_distribution).reduce(
    (sum, count) => sum + count,
    0,
  );

  return (
    <div className="mx-auto max-w-7xl px-4 lg:px-6 py-6 space-y-6">
      <TrackOnView event="view_brand_dashboard" payload={{ role: 'brand' }} />

      {/* ══════════════════════════════════════════════
          HEADER — minimal title + context
          ══════════════════════════════════════════════ */}
      <header>
        <h1 className="text-2xl font-semibold brand-tracking text-[var(--text-1)]">
          {data.profileBrand?.company_name || 'Dashboard'}
        </h1>
        <p className="mt-1 text-sm text-[var(--text-3)]">
          {data.stats.active_contests} campagne{data.stats.active_contests !== 1 ? 's' : ''} active
          {data.stats.active_contests !== 1 ? 's' : ''}
          {data.stats.pending_submissions > 0 && (
            <span className="ml-2 text-[var(--brand-accent)]">
              · {data.stats.pending_submissions} à modérer
            </span>
          )}
        </p>
      </header>

      <MetricsFreshnessBanner
        hasRealMetrics={hasRealMetrics}
        approvedSubmissionsCount={approvedSubmissionsCount}
      />

      {/* ══════════════════════════════════════════════
          12-COL GRID — Mission Control
          ══════════════════════════════════════════════ */}
      <div className="grid grid-cols-12 gap-6">

        {/* ──── Main column (8 cols) ──── */}
        <div className="col-span-12 lg:col-span-8 space-y-6">

          {/* ═══════════════════════════════════════════
              HERO — Active Campaign Focus / Onboarding
              ONLY beam + ONLY notch on this screen
              ═══════════════════════════════════════════ */}
          <GlassCard effect="beam" notched>
            {primaryCampaign ? (
              <div className="space-y-5">
                {/* Campaign title + status */}
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-[var(--r-pill)] px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide',
                          primaryCampaign.status === 'active'
                            ? 'bg-[var(--accent-soft)] text-[var(--brand-accent)]'
                            : 'bg-[var(--surface-2)] text-[var(--text-3)]',
                        )}
                      >
                        {primaryCampaign.status === 'active' && (
                          <span className="size-1.5 rounded-full bg-[var(--brand-accent)] animate-pulse" aria-hidden="true" />
                        )}
                        {statusLabel(primaryCampaign.status)}
                      </span>
                    </div>
                    <h2 className="text-lg font-semibold text-[var(--text-1)] brand-tracking truncate">
                      {primaryCampaign.title}
                    </h2>
                  </div>
                </div>

                {/* KPI row */}
                <div className="flex flex-col sm:flex-row sm:items-end gap-6">
                  {/* Primary KPI */}
                  <KpiHero
                    value={data.stats.total_views}
                    label="Vues totales"
                    className="flex-1"
                  />

                  {/* Secondary KPIs */}
                  <div className="flex gap-6 sm:gap-8">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">
                        Budget dépensé
                      </p>
                      <p className="mt-1 text-lg font-semibold brand-tabular text-[var(--text-1)]">
                        {formatCurrency(data.stats.budget_spent_cents, 'EUR')}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">
                        CPV / 1k
                      </p>
                      <p className="mt-1 text-lg font-semibold brand-tabular text-[var(--text-1)]">
                        {formatCurrency(cpv, 'EUR')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions — max 2, contextualized */}
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  {data.stats.pending_submissions > 0 ? (
                    <>
                      <Link href="/app/brand/moderation" className={ctaClass}>
                        <Inbox className="h-4 w-4" strokeWidth={1.5} />
                        Valider {data.stats.pending_submissions} vidéo{data.stats.pending_submissions > 1 ? 's' : ''}
                      </Link>
                      <Link
                        href={`/app/brand/contests/${primaryCampaign.id}`}
                        className={secondaryClass}
                      >
                        <Eye className="h-4 w-4" strokeWidth={1.5} />
                        Voir la campagne
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link
                        href={`/app/brand/contests/${primaryCampaign.id}`}
                        className={ctaClass}
                      >
                        <Eye className="h-4 w-4" strokeWidth={1.5} />
                        Voir la campagne
                      </Link>
                      <Link href="/app/brand/contests/new" className={secondaryClass}>
                        <Plus className="h-4 w-4" strokeWidth={1.5} />
                        Créer un concours
                      </Link>
                    </>
                  )}
                </div>
              </div>
            ) : (
              /* ── No active campaign — Onboarding Executive ── */
              <HeroOnboarding
                title="Aucune campagne active"
                subtitle="Lance une nouvelle campagne pour commencer à recevoir du contenu."
              />
            )}
          </GlassCard>

          {/* ═══════════════════════════════════════════
              ANALYTICS — ONLY track pattern on this screen
              ═══════════════════════════════════════════ */}
          <GlassCard pattern="track">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-[var(--text-1)] brand-tracking">
                Performance
              </h2>
              <AnalyticsPeriodToggle />
            </div>
            {roiChartData.some((d) => d.views > 0) ? (
              <div className="h-64">
                <RoiPerformanceChart
                  data={roiChartData}
                  currency="EUR"
                  variant="lens"
                  height="100%"
                  className="h-full"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 rounded-[var(--r2)] border border-dashed border-[var(--border-1)]">
                <p className="text-sm text-[var(--text-3)]">Aucune donnée sur la période</p>
                <p className="mt-1.5 text-xs text-[var(--text-3)]/70">
                  Les performances s&apos;affichent dès les premières publications.
                </p>
                <button
                  type="button"
                  className="mt-2 text-xs font-medium text-[var(--brand-accent)] hover:underline focus-visible:outline-none focus-visible:underline cursor-pointer"
                  aria-label="Comment lancer une campagne (bientôt disponible)"
                >
                  Comment lancer une campagne ?
                </button>
              </div>
            )}
          </GlassCard>
        </div>

        {/* ──── Side rail (4 cols) ──── */}
        <aside className="col-span-12 lg:col-span-4 space-y-6">

          {/* ═══════════════════════════════════════════
              LIVE QUEUE — realtime (client island)
              ═══════════════════════════════════════════ */}
          <DashboardPendingSubmissionsCard
            brandId={user.id}
            contestIds={data.active_contests.map((c) => c.id)}
            initialPendingSubmissions={data.stats.pending_submissions}
          />

          {/* ═══════════════════════════════════════════
              INSIGHTS — finance-grade trust rows
              ═══════════════════════════════════════════ */}
          <GlassCard>
            <h3 className="text-xs font-medium uppercase tracking-wide text-[var(--text-3)] mb-4">
              Insights
            </h3>
            <div className="space-y-3">
              {/* Top platform */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--text-2)]">Plateforme principale</span>
                {topPlatform ? (
                  <span className="text-sm font-semibold text-[var(--text-1)] capitalize">
                    {topPlatform}
                  </span>
                ) : (
                  <span className="text-xs italic text-[var(--text-3)]">Aucune donnée</span>
                )}
              </div>

              <div className="h-px bg-[var(--border-1)]" />

              {/* Best performing */}
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-[var(--text-2)] shrink-0">Meilleure campagne</span>
                {bestContest ? (
                  <span className="text-sm font-semibold text-[var(--text-1)] truncate text-right">
                    {bestContest.title}
                  </span>
                ) : (
                  <span className="text-xs italic text-[var(--text-3)]">Aucune donnée</span>
                )}
              </div>

              <div className="h-px bg-[var(--border-1)]" />

              {/* Budget remaining + progress bar */}
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--text-2)]">Budget restant</span>
                  <span className="text-sm font-semibold brand-tabular text-[var(--text-1)]">
                    {formatCurrency(Math.max(0, budgetRemaining), 'EUR')}
                  </span>
                </div>
                {/* Mini progress bar (2px) — shows remaining budget % */}
                <div className="mt-1.5 h-0.5 w-full rounded-full bg-[var(--surface-2)]">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      budgetRemainingPct > 20
                        ? 'bg-[var(--brand-accent)]'
                        : budgetRemainingPct > 0
                          ? 'bg-[var(--brand-warning)]'
                          : 'bg-[var(--brand-danger)]',
                    )}
                    role="progressbar"
                    {...{ 'aria-valuenow': budgetRemainingPct, 'aria-valuemin': 0, 'aria-valuemax': 100 }}
                    aria-label={`${budgetRemainingPct}% de budget restant`}
                    /* Dynamic width — inline style required for computed percentage */
                    style={{ width: `${budgetRemainingPct}%` }}
                  />
                </div>
              </div>

              <div className="h-px bg-[var(--border-1)]" />

              {/* Pending payments */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--text-2)]">Paiements en cours</span>
                <span
                  className={cn(
                    'text-sm font-semibold brand-tabular',
                    data.stats.pending_payments > 0
                      ? 'text-[var(--brand-warning)]'
                      : 'text-[var(--text-1)]',
                  )}
                >
                  {data.stats.pending_payments}
                </span>
              </div>
            </div>
          </GlassCard>
        </aside>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   DATA FETCHING — untouched from existing implementation
   ══════════════════════════════════════════════════════════ */

interface DashboardData {
  stats: {
    active_contests: number;
    pending_submissions: number;
    total_views: number;
    total_likes: number;
    budget_engaged_cents: number;
    budget_spent_cents: number;
    pending_payments: number;
  };
  active_contests: Array<{
    id: string;
    title: string;
    status: string;
    prize_pool_cents: number;
    currency: string;
    networks: string[];
    submissions_count: number;
    views: number;
    cpv: number;
  }>;
  recent_contests: Array<{
    id: string;
    title: string;
    status: string;
    prize_pool_cents: number;
    currency: string;
    networks: string[];
    created_at: string;
  }>;
  daily_views: Array<{ date: string; views: number }>;
  platform_distribution: Record<string, number>;
  profileBrand: {
    company_name: string;
  } | null;
}

async function fetchDashboardData(
  userId: string,
): Promise<{ data?: DashboardData; error?: string }> {
  try {
    const supabase = await getSupabaseSSR();
    const [
      { data: contests, error: contestsError },
      { data: dashboardMetrics, error: dashboardMetricsError },
      { count: pendingPayments },
      { data: profileBrand },
    ] = await Promise.all([
      supabase
        .from('contests')
        .select('id, title, status, prize_pool_cents, currency, networks, created_at, budget_cents')
        .eq('brand_id', userId)
        .order('created_at', { ascending: false }),
      supabase.rpc('get_brand_dashboard_metrics', { p_brand_id: userId }),
      supabase
        .from('payments_brand')
        .select('id', { count: 'exact', head: true })
        .eq('brand_id', userId)
        .in('status', ['requires_payment', 'processing']),
      supabase
        .from('profile_brands')
        .select('company_name')
        .eq('user_id', userId)
        .maybeSingle(),
    ]);

    if (contestsError) console.error('Contests fetch error', contestsError);
    if (dashboardMetricsError) console.error('Brand dashboard metrics RPC error', dashboardMetricsError);

    const contestRows = contests || [];
    const contestIds = contestRows.map((contest) => contest.id);
    const activeContests = contestRows.filter((contest) => contest.status === 'active');

    type BrandDashboardMetricRow = {
      contest_id: string;
      title: string;
      status: string;
      total_views: number | null;
      total_submissions: number | null;
      pending_submissions: number | null;
      budget_spent_cents: number | null;
    };

    const contestMetricsRows = ((dashboardMetrics as BrandDashboardMetricRow[] | null) || []);
    const contestMetricsById = new Map<string, BrandDashboardMetricRow>();

    let totalViews = 0;
    let pendingSubmissions = 0;
    let budgetSpent = 0;
    for (const metric of contestMetricsRows) {
      contestMetricsById.set(metric.contest_id, metric);
      totalViews += Number(metric.total_views || 0);
      pendingSubmissions += Number(metric.pending_submissions || 0);
      budgetSpent += Number(metric.budget_spent_cents || 0);
    }

    const totalLikes = 0;
    const budgetEngaged = contestRows.reduce((sum, contest) => sum + (contest.budget_cents || 0), 0);

    const buildLast7DaysZeroViews = () => {
      const days: Array<{ date: string; views: number }> = [];
      const today = new Date();
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        days.push({ date: date.toISOString().split('T')[0], views: 0 });
      }
      return days;
    };

    let dailyViews: Array<{ date: string; views: number }> = buildLast7DaysZeroViews();
    const platformDistribution: Record<string, number> = {};

    if (contestIds.length > 0) {
      const [
        { data: contestSubmissions, error: submissionsError },
        { data: approvedSubmissions, error: approvedSubmissionsError },
      ] = await Promise.all([
        supabase.from('submissions').select('id').in('contest_id', contestIds),
        supabase.from('submissions').select('platform').in('contest_id', contestIds).eq('status', 'approved'),
      ]);

      if (submissionsError) console.error('Dashboard submissions fetch error', submissionsError);
      if (approvedSubmissionsError) console.error('Dashboard approved submissions fetch error', approvedSubmissionsError);

      approvedSubmissions?.forEach((submission) => {
        const platform = submission.platform as string;
        platformDistribution[platform] = (platformDistribution[platform] || 0) + 1;
      });

      const submissionIds = contestSubmissions?.map((submission) => submission.id) || [];
      if (submissionIds.length > 0) {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const { data: metrics, error: metricsError } = await supabase
          .from('metrics_daily')
          .select('metric_date, views')
          .in('submission_id', submissionIds)
          .gte('metric_date', sevenDaysAgo.toISOString().split('T')[0]);

        if (metricsError) {
          console.error('Dashboard daily metrics fetch error', metricsError);
        } else {
          const viewsByDate = new Map<string, number>();
          metrics?.forEach((metric) => {
            const date = metric.metric_date;
            const current = viewsByDate.get(date) || 0;
            viewsByDate.set(date, current + (metric.views || 0));
          });

          dailyViews = buildLast7DaysZeroViews().map((day) => ({
            date: day.date,
            views: viewsByDate.get(day.date) || 0,
          }));
        }
      }
    }

    const activeContestsWithMetrics = activeContests.slice(0, 6).map((contest) => {
      const metric = contestMetricsById.get(contest.id);
      const views = Number(metric?.total_views || 0);
      const submissions = Number(metric?.total_submissions || 0);
      const cpvVal = views > 0 ? Math.round(((contest.prize_pool_cents || 0) / views) * 1000) : 0;

      return {
        id: contest.id,
        title: contest.title,
        status: contest.status,
        prize_pool_cents: contest.prize_pool_cents,
        currency: contest.currency || 'EUR',
        networks: (contest.networks as string[]) || [],
        submissions_count: submissions,
        views,
        cpv: cpvVal,
      };
    });

    const recentContests = contestRows.slice(0, 5).map((contest) => ({
      id: contest.id,
      title: contest.title,
      status: contest.status,
      prize_pool_cents: contest.prize_pool_cents,
      currency: contest.currency || 'EUR',
      networks: (contest.networks as string[]) || [],
      created_at: contest.created_at,
    }));

    return {
      data: {
        stats: {
          active_contests: activeContests.length,
          pending_submissions: pendingSubmissions,
          total_views: totalViews,
          total_likes: totalLikes,
          budget_engaged_cents: budgetEngaged,
          budget_spent_cents: budgetSpent,
          pending_payments: pendingPayments || 0,
        },
        active_contests: activeContestsWithMetrics,
        recent_contests: recentContests,
        daily_views: dailyViews,
        platform_distribution: platformDistribution,
        profileBrand,
      },
    };
  } catch (err) {
    console.error('Brand dashboard load error', err);
    return {
      error: 'Impossible de charger le dashboard. Réessaie plus tard ou contacte le support.',
    };
  }
}
