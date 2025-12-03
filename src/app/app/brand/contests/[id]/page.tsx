/*
Page: Brand contest detail
Objectifs: statistiques, UGC (submissions), leaderboard, actions (modifier, dupliquer, promouvoir)
*/
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BrandEmptyState } from '@/components/brand/empty-state-enhanced';
import { StatCard } from '@/components/creator/stat-card';
import { formatCurrency, formatDate } from '@/lib/formatters';
import {
  Edit,
  Copy,
  ExternalLink,
  Eye,
  TrendingUp,
  DollarSign,
  Users,
  FileText,
  Trophy,
  Share2,
  MessageSquare,
  AlertCircle,
  Download,
} from 'lucide-react';
import { TrackOnView } from '@/components/analytics/track-once';
import { PlatformBadge } from '@/components/creator/platform-badge';
import { ContestMetricsChart } from '@/components/brand/contest-metrics-chart';
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
  const cpv = metrics.total_views > 0 ? Math.round((contest.prize_pool_cents / metrics.total_views) * 1000) : 0;

  return (
    <main className="space-y-8">
      <TrackOnView event="view_brand_contest_detail" payload={{ contest_id: id, status: contest.status }} />

      {/* En-tête */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-3xl font-semibold">{contest.title}</h1>
            <Badge
              variant={
                isDraft ? 'secondary' : isActive ? 'success' : isEnded ? 'warning' : 'info'
              }
            >
              {isDraft ? 'Brouillon' : isActive ? 'Actif' : isEnded ? 'Terminé' : contest.status}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            {contest.start_at && formatDate(contest.start_at)} → {formatDate(contest.end_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isDraft && (
            <Button asChild variant="secondary">
              <Link href={`/app/brand/contests/${id}/edit`}>
                <Edit className="h-4 w-4 mr-2" />
                Modifier
              </Link>
            </Button>
          )}
          <Button asChild variant="secondary">
            <Link href={`/contests/${id}`} target="_blank">
              <ExternalLink className="h-4 w-4 mr-2" />
              Voir page publique
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={`/app/brand/contests/new?duplicate=${id}`}>
              <Copy className="h-4 w-4 mr-2" />
              Dupliquer
            </Link>
          </Button>
        </div>
      </div>

      {/* Statistiques */}
      <section>
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard
            label="Vues totales"
            value={metrics.total_views.toLocaleString()}
            hint="Toutes soumissions confondues"
            icon={<Eye className="h-4 w-4" />}
          />
          <StatCard
            label="Engagement"
            value={metrics.total_likes.toLocaleString()}
            hint="Likes total"
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <StatCard
            label="CPV"
            value={cpv > 0 ? formatCurrency(cpv, contest.currency) : '—'}
            hint="Coût pour 1000 vues"
            icon={<DollarSign className="h-4 w-4" />}
          />
          <StatCard
            label="Soumissions"
            value={String(metrics.approved_submissions)}
            hint={`${submissions.pending} en attente`}
            icon={<FileText className="h-4 w-4" />}
          />
        </div>
      </section>

      {/* Graphique croissance journalière */}
      <Card>
        <CardHeader>
          <CardTitle>Croissance journalière</CardTitle>
          <p className="text-sm text-muted-foreground">
            Évolution des vues quotidiennes depuis le début du concours
          </p>
        </CardHeader>
        <CardContent>
          <ContestMetricsChart data={metrics.daily_views} />
        </CardContent>
      </Card>

      {/* UGC (Submissions) */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold">Soumissions</h2>
            <p className="text-sm text-muted-foreground">
              {submissions.pending > 0 && (
                <span className="text-warning">
                  {submissions.pending} en attente de modération
                </span>
              )}
              {submissions.pending === 0 && 'Toutes les soumissions sont modérées'}
            </p>
          </div>
          <Button asChild>
            <Link href={`/app/brand/contests/${id}/submissions`}>
              <FileText className="h-4 w-4 mr-2" />
              Voir toutes les soumissions
            </Link>
          </Button>
        </div>

        {submissions.recent.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
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
            </CardContent>
          </Card>
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
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold">Classement</h2>
            <p className="text-sm text-muted-foreground">Top créateurs par vues pondérées</p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link href={`/app/brand/contests/${id}/leaderboard`}>
                Voir le classement complet
              </Link>
            </Button>
            <Button
              asChild
              variant="secondary"
              size="sm"
              className="flex items-center gap-2"
            >
              <a href={`/api/contests/${id}/export-pdf`} target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4" />
                Export PDF
              </a>
            </Button>
          </div>
        </div>

        {leaderboard.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground text-center">
                Aucun classement disponible pour le moment.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                {leaderboard.slice(0, 10).map((entry: { creator_id: string; creator_name: string | null; total_views: number; total_likes: number; estimated_payout_cents: number }, index: number) => (
                  <div
                    key={entry.creator_id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{entry.creator_name || 'Créateur anonyme'}</p>
                        <p className="text-xs text-muted-foreground">
                          {entry.total_views.toLocaleString()} vues • {entry.total_likes.toLocaleString()} likes
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {formatCurrency(entry.estimated_payout_cents, contest.currency)}
                      </p>
                      <p className="text-xs text-muted-foreground">Gain estimé</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      {/* CTA */}
      <section className="grid gap-4 md:grid-cols-2">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Promouvoir le concours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Partage le concours sur tes réseaux pour attirer plus de créateurs.
            </p>
            <Button variant="secondary" className="w-full" disabled>
              Générer le lien de partage
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Contacter les participants
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Envoie un message à tous les créateurs qui ont participé.
            </p>
            <Button variant="secondary" className="w-full" disabled>
              Envoyer un message
            </Button>
          </CardContent>
        </Card>
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
    <Card className="group transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover border-border/60 hover:border-primary/20">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="font-medium line-clamp-1">{submission.creator_name || 'Créateur'}</p>
            <PlatformBadge platform={submission.platform as Platform} className="mt-1" />
          </div>
          <Badge
            variant={
              submission.status === 'approved'
                ? 'success'
                : submission.status === 'rejected'
                  ? 'danger'
                  : 'warning'
            }
          >
            {submission.status === 'approved'
              ? 'Approuvé'
              : submission.status === 'rejected'
                ? 'Refusé'
                : 'En attente'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <a
          href={submission.external_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary hover:underline line-clamp-1 transition-colors duration-150 hover:text-primary/80"
        >
          {submission.external_url}
        </a>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-muted-foreground">Vues</p>
            <p className="font-semibold">{submission.views.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Likes</p>
            <p className="font-semibold">{submission.likes.toLocaleString()}</p>
          </div>
        </div>
        <Button asChild size="sm" variant="secondary" className="w-full transition-all duration-200 hover:scale-[1.02]">
          <Link href={`/app/brand/contests/${contestId}/submissions?submission=${submission.id}`}>
            {submission.status === 'pending' ? 'Modérer' : 'Voir détails'}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

async function fetchContestData(contestId: string, userId: string) {
  const supabase = await getSupabaseSSR();

  // Récupérer le concours (vérification ownership via RLS)
  const { data: contest, error: contestError } = await supabase
    .from('contests')
    .select(
      'id, title, brief_md, cover_url, status, prize_pool_cents, currency, start_at, end_at, networks, brand_id'
    )
    .eq('id', contestId)
    .eq('brand_id', userId)
    .maybeSingle();

  if (contestError || !contest) {
    return { error: 'Contest not found', contest: null, metrics: null, submissions: null, leaderboard: null };
  }

  // Récupérer toutes les soumissions du concours pour les métriques
  const { data: allSubmissions } = await supabase
    .from('submissions')
    .select('id')
    .eq('contest_id', contestId);
  
  const allSubmissionIds = allSubmissions?.map((s) => s.id) || [];

  // Récupérer les métriques via RPC
  const { data: metricsData } = await supabase.rpc('get_contest_metrics', {
    p_contest_id: contestId,
  });

  // Récupérer les vues quotidiennes depuis metrics_daily
  const dailyViews: Array<{ date: string; views: number }> = [];
  if (allSubmissionIds.length > 0) {
    const { data: dailyMetrics } = await supabase
      .from('metrics_daily')
      .select('metric_date, views')
      .in('submission_id', allSubmissionIds)
      .order('metric_date', { ascending: true });

    // Agréger par date
    const viewsByDate = new Map<string, number>();
    dailyMetrics?.forEach((m: { metric_date: string; views: number }) => {
      const date = m.metric_date;
      const current = viewsByDate.get(date) || 0;
      viewsByDate.set(date, current + (m.views || 0));
    });
    viewsByDate.forEach((views, date) => {
      dailyViews.push({ date, views });
    });
    dailyViews.sort((a, b) => a.date.localeCompare(b.date));
  }

  const metrics = metricsData && metricsData.length > 0
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

  // Récupérer les soumissions récentes
  const { data: submissionsData } = await supabase
    .from('submissions')
    .select(
      'id, external_url, platform, status, creator_id, submitted_at, creator:creator_id(display_name)'
    )
    .eq('contest_id', contestId)
    .order('submitted_at', { ascending: false })
    .limit(6);

  // Compter les soumissions en attente
  const { count: pendingCount } = await supabase
    .from('submissions')
    .select('id', { count: 'exact', head: true })
    .eq('contest_id', contestId)
    .eq('status', 'pending');

  // Récupérer les métriques des soumissions
  const submissionIds = submissionsData?.map((s) => s.id) || [];
  const submissionsWithMetrics = await Promise.all(
    (submissionsData || []).map(async (submission) => {
      const { data: metrics } = await supabase
        .from('metrics_daily')
        .select('views, likes')
        .eq('submission_id', submission.id);

      const totalViews = metrics?.reduce((sum, m) => sum + (m.views || 0), 0) || 0;
      const totalLikes = metrics?.reduce((sum, m) => sum + (m.likes || 0), 0) || 0;

      return {
        id: submission.id,
        external_url: submission.external_url,
        platform: submission.platform,
        status: submission.status,
        creator_name: (submission.creator as { display_name?: string | null } | null)?.display_name || null,
        views: totalViews,
        likes: totalLikes,
      };
    })
  );

  // Récupérer le leaderboard
  const { data: leaderboardData } = await supabase.rpc('get_contest_leaderboard', {
    p_contest_id: contestId,
    p_limit: 30,
  });

  // Récupérer les créateurs pour le leaderboard
  const creatorIds = leaderboardData?.map((l: { creator_id: string }) => l.creator_id) || [];
  const { data: creators } = creatorIds.length > 0
    ? await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', creatorIds)
    : { data: null };

  const creatorMap = new Map(
    (creators || []).map((c) => [c.id, c.display_name || null])
  );

  // Récupérer les prix pour calculer les gains estimés
  const { data: prizes } = await supabase
    .from('contest_prizes')
    .select('position, amount_cents, percentage')
    .eq('contest_id', contestId)
    .order('position', { ascending: true });

  const leaderboard = (leaderboardData || []).map((entry: any, index: number) => {
    const rank = index + 1;
    const prize = prizes?.find((p) => p.position === rank);
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

  return {
    contest,
    metrics,
    submissions: {
      recent: submissionsWithMetrics,
      pending: pendingCount || 0,
    },
    leaderboard,
    error: null,
  };
}
