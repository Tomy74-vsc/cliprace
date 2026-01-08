/*
Page: Brand dashboard
Objectifs: KPIs, concours en cours, graphiques (vues 7j, répartition plateformes), ROI, CTA "Créer un concours"
*/
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { StatCard } from '@/components/creator/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BrandEmptyState } from '@/components/brand/empty-state-enhanced';
import { formatCurrency } from '@/lib/formatters';
import { Trophy, Plus, TrendingUp, Eye, DollarSign, AlertCircle } from 'lucide-react';
import { TrackOnView } from '@/components/analytics/track-once';
import { PlatformBadge } from '@/components/creator/platform-badge';
import { ContestMetricsChart } from '@/components/brand/contest-metrics-chart';
import { PlatformDistributionChart } from '@/components/brand/platform-distribution-chart';
import type { Platform } from '@/lib/validators/platforms';

export const revalidate = 60;

export default async function BrandDashboard() {
  const { user } = await getSession();
  if (!user) return null;

  const { data, error } = await fetchDashboardData(user.id);

  if (error) {
    return (
      <main className="space-y-6">
        <BrandEmptyState
          type="error"
          title="Erreur de chargement"
          description="Impossible de charger le dashboard. Réessaie plus tard ou contacte le support si le problème persiste."
          action={{ label: 'Réessayer', href: '/app/brand/dashboard' }}
        />
      </main>
    );
  }

  if (!data) return null;

  const companyName = data.profileBrand?.company_name || 'Marque';
  const firstName = (user.display_name || companyName).split(' ')[0] || 'Marque';

  return (
    <main className="space-y-8">
      <TrackOnView event="view_brand_dashboard" payload={{ role: 'brand' }} />

      {/* Phrase d'accroche */}
      {data.stats.total_views > 0 && (
        <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-accent/5 to-background">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-xl font-semibold leading-relaxed">
                ClipRace attire des créateurs pour vous.{' '}
                {(() => {
                  const last7DaysViews = data.daily_views.reduce((sum, d) => sum + d.views, 0);
                  const last7DaysSpent = data.stats.budget_spent_cents;
                  const cpv = last7DaysViews > 0 ? Math.round((last7DaysSpent / last7DaysViews) * 1000) : 0;
                  return last7DaysViews > 0
                    ? `Cette semaine, vos campagnes ont généré ${last7DaysViews.toLocaleString()} vues pour ${formatCurrency(last7DaysSpent, 'EUR')}, soit ${formatCurrency(cpv, 'EUR')} pour 1 000 vues.`
                    : `Vos campagnes ont généré ${data.stats.total_views.toLocaleString()} vues au total pour ${formatCurrency(data.stats.budget_spent_cents, 'EUR')}, soit ${formatCurrency(Math.round((data.stats.budget_spent_cents / data.stats.total_views) * 1000), 'EUR')} pour 1 000 vues.`;
                })()}
              </p>
              <p className="text-sm text-muted-foreground">
                Plus vous augmentez votre cashprize, plus vous attirez de créateurs et de vues.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Carte "Créer un concours" - CTA primaire */}
      <section className="rounded-3xl border border-border bg-gradient-to-r from-primary/10 via-accent/5 to-background p-6 md:p-8 shadow-card transition-all duration-300 hover:shadow-card-hover hover:from-primary/15 hover:via-accent/8">
        <div className="grid gap-6 md:grid-cols-[2fr,1.1fr] md:items-center">
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Espace marque</p>
            <h1 className="text-3xl font-semibold">Bienvenue, {firstName}</h1>
            <p className="text-base text-muted-foreground">
              Crée et pilote tes concours UGC, modère les participations, suivez les performances.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="transition-all duration-200 hover:scale-105 hover:shadow-lg">
                <Link href="/app/brand/contests/new">
                  <Plus className="h-5 w-5 mr-2" />
                  Créer un concours
                </Link>
              </Button>
              <Button asChild variant="secondary" size="lg" className="transition-all duration-200 hover:scale-105">
                <Link href="/app/brand/contests">Voir mes concours</Link>
              </Button>
            </div>
          </div>
          <Card className="bg-card/80 backdrop-blur-xl border-dashed border-border">
            <CardHeader className="pb-2">
              <CardTitle>État global</CardTitle>
              <p className="text-sm text-muted-foreground">Vue d&apos;ensemble de tes concours.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Concours actifs</p>
                  <p className="text-2xl font-semibold">{data.stats.active_contests}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Soumissions en attente</p>
                  <p className="text-2xl font-semibold text-warning">
                    {data.stats.pending_submissions}
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-border">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Budget engagé</span>
                  <span className="font-semibold">
                    {formatCurrency(data.stats.budget_engaged_cents, 'EUR')}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-muted-foreground">Vues cumulées</span>
                  <span className="font-semibold">{data.stats.total_views.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* KPIs */}
      <section>
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard
            label="Vues cumulées"
            value={data.stats.total_views.toLocaleString()}
            hint="Tous concours confondus"
            icon={<Eye className="h-4 w-4" />}
          />
          <StatCard
            label="Engagement"
            value={data.stats.total_likes.toLocaleString()}
            hint="Likes total"
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <StatCard
            label="CPV"
            value={
              data.stats.total_views > 0
                ? formatCurrency(
                    Math.round((data.stats.budget_spent_cents / data.stats.total_views) * 1000),
                    'EUR',
                  )
                : '—'
            }
            hint="Coût pour 1000 vues"
            icon={<DollarSign className="h-4 w-4" />}
          />
          <StatCard
            label="Budget dépensé"
            value={formatCurrency(data.stats.budget_spent_cents, 'EUR')}
            hint="Total"
            icon={<Trophy className="h-4 w-4" />}
          />
        </div>
      </section>

      {/* Section "Concours en cours" */}
      {data.active_contests.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Concours en cours</h2>
              <p className="text-sm text-muted-foreground">
                Suis les performances de tes concours actifs.
              </p>
            </div>
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/app/brand/contests">Tout voir</Link>
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.active_contests.map((contest) => (
              <ActiveContestCard key={contest.id} contest={contest} />
            ))}
          </div>
        </section>
      )}

      {/* Graphiques */}
      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Vues des 7 derniers jours</CardTitle>
            <p className="text-sm text-muted-foreground">
              Évolution quotidienne des vues sur tous vos concours
            </p>
          </CardHeader>
          <CardContent>
            <ContestMetricsChart data={data.daily_views} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Répartition par plateforme</CardTitle>
            <p className="text-sm text-muted-foreground">
              Distribution des soumissions selon les plateformes
            </p>
          </CardHeader>
          <CardContent>
            <PlatformDistributionChart data={data.platform_distribution} />
          </CardContent>
        </Card>
      </section>

      {/* Section "Concours récents" */}
      {data.recent_contests.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Concours récents</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href="/app/brand/contests">Tout voir</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {data.recent_contests.map((contest) => (
                <RecentContestCard key={contest.id} contest={contest} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notifications importantes */}
      {(data.stats.pending_payments > 0 || data.stats.pending_submissions > 0) && (
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-warning" />
              Actions requises
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.stats.pending_payments > 0 && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Paiement requis</p>
                  <p className="text-sm text-muted-foreground">
                    {data.stats.pending_payments} paiement{data.stats.pending_payments > 1 ? 's' : ''} en attente
                  </p>
                </div>
                <Button asChild size="sm">
                  <Link href="/app/brand/billing">Régler</Link>
                </Button>
              </div>
            )}
            {data.stats.pending_submissions > 0 && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Soumissions en attente</p>
                  <p className="text-sm text-muted-foreground">
                    {data.stats.pending_submissions} soumission{data.stats.pending_submissions > 1 ? 's' : ''} à modérer
                  </p>
                </div>
                <Button asChild size="sm">
                  <Link href="/app/brand/contests">Modérer</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Empty state si aucun concours */}
      {data.active_contests.length === 0 && data.recent_contests.length === 0 && (
        <BrandEmptyState
          type="no-contests"
          action={{
            label: 'Créer un concours',
            href: '/app/brand/contests/new',
            variant: 'primary',
          }}
        />
      )}
    </main>
  );
}

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
    // Récupérer tous les concours de la marque
    const { data: contests, error: contestsError } = await supabase
      .from('contests')
      .select('id, title, status, prize_pool_cents, currency, networks, created_at, budget_cents')
      .eq('brand_id', userId)
      .order('created_at', { ascending: false });

    if (contestsError) {
      console.error('Contests fetch error', contestsError);
    }

    const contestIds = contests?.map((c) => c.id) || [];
    const activeContests = contests?.filter((c) => c.status === 'active') || [];

    // Récupérer les stats via la vue contest_stats
    let totalViews = 0;
    let totalLikes = 0;
    const contestMetrics: Record<string, { views: number; submissions: number }> = {};

    if (contestIds.length > 0) {
      for (const contest of activeContests) {
        const { data: metrics } = await supabase.rpc('get_contest_metrics', {
          p_contest_id: contest.id,
        });
        if (metrics && metrics.length > 0) {
          const m = metrics[0];
          const views = Number(m.total_views || 0);
          const submissions = Number(m.approved_submissions || 0);
          totalViews += views;
          totalLikes += Number(m.total_likes || 0);
          contestMetrics[contest.id] = { views, submissions };
        }
      }
    }

    // Compter les soumissions en attente
    let pendingSubmissions = 0;
    if (contestIds.length > 0) {
      const { count } = await supabase
        .from('submissions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
        .in('contest_id', contestIds);
      pendingSubmissions = count || 0;
    }

    // Compter les paiements en attente
    const { count: pendingPayments } = await supabase
      .from('payments_brand')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', userId)
      .in('status', ['requires_payment', 'processing']);

    // Calculer les budgets
    const budgetEngaged = contests?.reduce((sum, c) => sum + (c.budget_cents || 0), 0) || 0;
    const budgetSpent = contests?.reduce((sum, _contest) => {
      // TODO: calculer le budget réellement dépensé (prize_pool payé)
      return sum;
    }, 0) || 0;

    // Récupérer les métriques quotidiennes des 7 derniers jours
    const dailyViews: Array<{ date: string; views: number }> = [];
    if (contestIds.length > 0) {
      // Récupérer d'abord les IDs des soumissions
      const { data: submissions } = await supabase
        .from('submissions')
        .select('id')
        .in('contest_id', contestIds);
      
      const submissionIds = submissions?.map((s) => s.id) || [];
      
      if (submissionIds.length > 0) {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const { data: metrics } = await supabase
          .from('metrics_daily')
          .select('metric_date, views')
          .in('submission_id', submissionIds)
          .gte('metric_date', sevenDaysAgo.toISOString().split('T')[0]);

        // Agréger par date
        const viewsByDate = new Map<string, number>();
        metrics?.forEach((m) => {
          const date = m.metric_date;
          const current = viewsByDate.get(date) || 0;
          viewsByDate.set(date, current + (m.views || 0));
        });

        // Remplir les 7 derniers jours (même si pas de données)
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split('T')[0];
          dailyViews.push({
            date: dateStr,
            views: viewsByDate.get(dateStr) || 0,
          });
        }
      } else {
        // Aucune soumission, remplir avec des zéros
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          dailyViews.push({
            date: date.toISOString().split('T')[0],
            views: 0,
          });
        }
      }
    } else {
      // Aucun concours, remplir avec des zéros
      const today = new Date();
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        dailyViews.push({
          date: date.toISOString().split('T')[0],
          views: 0,
        });
      }
    }

    // Répartition par plateforme
    const platformDistribution: Record<string, number> = {};
    if (contestIds.length > 0) {
      const { data: submissions } = await supabase
        .from('submissions')
        .select('platform')
        .in('contest_id', contestIds)
        .eq('status', 'approved');
      submissions?.forEach((s) => {
        const platform = s.platform as string;
        platformDistribution[platform] = (platformDistribution[platform] || 0) + 1;
      });
    }

    // Préparer les concours actifs avec métriques
    const activeContestsWithMetrics = activeContests.slice(0, 6).map((contest) => {
      const metrics = contestMetrics[contest.id] || { views: 0, submissions: 0 };
      const cpv =
        metrics.views > 0
          ? Math.round(((contest.prize_pool_cents || 0) / metrics.views) * 1000)
          : 0;
      return {
        id: contest.id,
        title: contest.title,
        status: contest.status,
        prize_pool_cents: contest.prize_pool_cents,
        currency: contest.currency || 'EUR',
        networks: (contest.networks as string[]) || [],
        submissions_count: metrics.submissions,
        views: metrics.views,
        cpv,
      };
    });

    // Concours récents (5 derniers)
    const recentContests = (contests || []).slice(0, 5).map((contest) => ({
      id: contest.id,
      title: contest.title,
      status: contest.status,
      prize_pool_cents: contest.prize_pool_cents,
      currency: contest.currency || 'EUR',
      networks: (contest.networks as string[]) || [],
      created_at: contest.created_at,
    }));

    // Récupérer le profil brand
    const { data: profileBrand } = await supabase
      .from('profile_brands')
      .select('company_name')
      .eq('user_id', userId)
      .maybeSingle();

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

function ActiveContestCard({
  contest,
}: {
  contest: {
    id: string;
    title: string;
    status: string;
    prize_pool_cents: number;
    currency: string;
    networks: string[];
    submissions_count: number;
    views: number;
    cpv: number;
  };
}) {
  return (
    <Card className="group transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover border-border/60 hover:border-primary/20">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg line-clamp-2">{contest.title}</CardTitle>
          <Badge variant="success">Actif</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">Vues</p>
            <p className="font-semibold">{contest.views.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Soumissions</p>
            <p className="font-semibold">{contest.submissions_count}</p>
          </div>
          <div>
            <p className="text-muted-foreground">CPV</p>
            <p className="font-semibold">{formatCurrency(contest.cpv, contest.currency)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Prize pool</p>
            <p className="font-semibold">
              {formatCurrency(contest.prize_pool_cents, contest.currency)}
            </p>
          </div>
        </div>
        {contest.networks.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {contest.networks.slice(0, 3).map((network) => (
              <PlatformBadge key={network} platform={network as Platform} />
            ))}
          </div>
        )}
        <Button asChild size="sm" variant="secondary" className="w-full transition-all duration-200 hover:scale-[1.02]">
          <Link href={`/app/brand/contests/${contest.id}`}>Voir le concours</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function RecentContestCard({
  contest,
}: {
  contest: {
    id: string;
    title: string;
    status: string;
    prize_pool_cents: number;
    currency: string;
    networks: string[];
    created_at: string;
  };
}) {
  const statusLabels: Record<string, string> = {
    draft: 'Brouillon',
    active: 'Actif',
    ended: 'Terminé',
    archived: 'Archivé',
  };

  const statusVariants: Record<string, 'secondary' | 'success' | 'warning' | 'info'> = {
    draft: 'secondary',
    active: 'success',
    ended: 'warning',
    archived: 'info',
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover hover:border-primary/20">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground line-clamp-2">{contest.title}</p>
          <Badge variant={statusVariants[contest.status] || 'secondary'} className="mt-1">
            {statusLabels[contest.status] || contest.status}
          </Badge>
        </div>
      </div>
      {contest.networks.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {contest.networks.slice(0, 3).map((network) => (
            <PlatformBadge key={network} platform={network as Platform} />
          ))}
        </div>
      )}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Prize pool</span>
        <span className="font-semibold text-foreground">
          {formatCurrency(contest.prize_pool_cents, contest.currency)}
        </span>
      </div>
      <Button asChild size="sm" variant="secondary" className="justify-center transition-all duration-200 hover:scale-[1.02]">
        <Link href={`/app/brand/contests/${contest.id}`}>Voir le concours</Link>
      </Button>
    </div>
  );
}
