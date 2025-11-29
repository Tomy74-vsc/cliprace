/*
Page: Creator dashboard
Objectifs: stats, prochaine échéance, recommandations, notifications, milestones.
*/
import { Suspense } from 'react';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { StatCard } from '@/components/creator/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/creator/empty-state';
import { ProgressSteps, type ProgressStep } from '@/components/creator/progress-steps';
import { formatCurrency } from '@/lib/formatters';
import { Trophy, Clock, Bell, Lightbulb, Wallet2, ListVideo, Info } from 'lucide-react';
import { TrackOnView } from '@/components/analytics/track-once';
import { PlatformBadge } from '@/components/creator/platform-badge';
import {
  ActiveContestsCarousel,
  ActiveContestsCarouselSkeleton,
} from '@/components/creator/active-contests-carousel';
import type { Platform } from '@/lib/validators/platforms';

export const revalidate = 60;

export default async function CreatorDashboard() {
  const { user } = await getSession();
  if (!user) return null;

  const { data, error } = await fetchDashboardData(user.id);

  if (error) {
    return (
      <main className="space-y-6">
        <EmptyState
          title="Erreur de chargement"
          description="Impossible de charger le dashboard. Réessaie plus tard ou contacte le support si le problème persiste."
          action={{ label: 'Réessayer', href: '/app/creator/dashboard', variant: 'secondary' }}
        />
      </main>
    );
  }

  if (!data) return null;

  const milestones: ProgressStep[] = [
    {
      title: 'Onboarding terminé',
      state: 'completed',
      description: 'Profil créateur prêt',
    },
    {
      title: 'Première participation',
      state: data.stats.submissions_count > 0 ? 'completed' : 'current',
      description: 'Soumets une première vidéo',
    },
    {
      title: 'Vidéo approuvée',
      state: data.stats.approved_submissions > 0 ? 'completed' : 'upcoming',
      description: 'Statut approuvé',
    },
    {
      title: 'Premier gain',
      state: data.stats.total_earnings_cents > 0 ? 'completed' : 'upcoming',
      description: 'Gains visibles',
    },
  ];

  const tips = [
    'Priorise les concours qui se terminent bientôt.',
    'Ajoute #ClipRace et le hashtag de la marque pour éviter les refus.',
    'Vérifie tes liens vidéo avant de soumettre.',
  ];

  const firstName = (user.display_name || '').split(' ')[0] || 'créateur';
  const countdown = data.next_contest ? computeCountdown(data.next_contest.end_at) : null;
  const todo = buildTodoList({
    profileIncomplete: data.profileIncomplete,
    hasSubmissions: data.stats.submissions_count > 0,
    hasUnread: data.stats.unread_notifications > 0,
    nextContest: data.next_contest,
    canSubmitNext: data.next_contest_can_submit,
    hasEarnings: data.stats.total_earnings_cents > 0,
  });

  return (
    <main className="space-y-8">
      <TrackOnView event="view_dashboard" payload={{ role: 'creator' }} />

      <section className="rounded-3xl border border-border bg-gradient-to-r from-primary/10 via-accent/5 to-background p-6 md:p-8 shadow-card">
        <div className="grid gap-6 md:grid-cols-[2fr,1.1fr] md:items-center">
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Espace créateur</p>
            <h1 className="text-3xl font-semibold">Bienvenue, {firstName}</h1>
            <p className="text-base text-muted-foreground">
              Participe aux concours, suis tes vues, encaisse tes gains en toute sécurité.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/app/creator/contests">Découvrir les concours</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/app/creator/submissions">Mes soumissions</Link>
              </Button>
            </div>
          </div>
          <Card className="bg-card/80 backdrop-blur-xl border-dashed border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle>Prochaine échéance</CardTitle>
                {data.next_contest ? (
                  <Badge variant="success">{countdown?.label ?? 'Actif'}</Badge>
                ) : (
                  <Badge variant="secondary">Aucun concours</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">Suis la date limite pour ne rien rater.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.next_contest ? (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{data.next_contest.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Prize pool{' '}
                        {formatCurrency(data.next_contest.prize_pool_cents, data.next_contest.currency)}
                      </p>
                    </div>
                    <Badge variant="info" className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {countdown?.short ?? 'En cours'}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Fin le {new Date(data.next_contest.end_at).toLocaleDateString('fr-FR')}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm" disabled={!data.next_contest_can_submit}>
                      <Link href={`/app/creator/contests/${data.next_contest.id}`}>
                        {data.next_contest_can_submit ? 'Participer' : 'Voir le concours'}
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="secondary">
                      <Link href="/app/creator/submissions">Suivre mes soumissions</Link>
                    </Button>
                  </div>
                  {!data.next_contest_can_submit && (
                    <p className="text-xs text-muted-foreground">
                      Éligibilité requise (plateforme ou seuils). Vérifie le brief pour débloquer la participation.
                    </p>
                  )}
                </>
              ) : (
                <EmptyState
                  title="Aucun concours en cours"
                  description="Découvre les opportunités disponibles."
                  action={{
                    label: 'Découvrir les concours',
                    href: '/app/creator/contests',
                    variant: 'secondary',
                  }}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-semibold">Concours en ligne</h2>
            <p className="text-sm text-muted-foreground">
              Les opportunités ouvertes maintenant, prêtes à filmer.
            </p>
          </div>
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/app/creator/contests">Tout voir</Link>
          </Button>
        </div>
        <Suspense fallback={<ActiveContestsCarouselSkeleton />}>
          <ActiveContestsCarousel />
        </Suspense>
      </section>

      <section>
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard label="Participations" value={String(data.stats.submissions_count)} hint="Total" />
          <StatCard
            label="En compétition"
            value={String(data.stats.approved_submissions)}
            hint="Soumissions actives"
          />
          <StatCard
            label="Vues cumulées"
            value={String(data.stats.views_total)}
            hint="Soumissions approuvées"
          />
          <StatCard
            label="Gains cumulés"
            value={formatCurrency(data.stats.total_earnings_cents, 'EUR')}
            hint="Total gagné"
            icon={<Trophy className="h-4 w-4" />}
          />
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>À faire</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {todo.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tu es à jour. Continue à participer !</p>
            ) : (
              <ul className="space-y-2">
                {todo.map((item) => (
                  <li key={item.title} className="flex items-start gap-2">
                    <Badge variant={item.variant} className="mt-0.5">
                      {item.label}
                    </Badge>
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.title}</p>
                      {item.description ? (
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>Notifications</CardTitle>
              {data.stats.unread_notifications > 0 && (
                <Badge variant="danger">{data.stats.unread_notifications} non lues</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.notifications.length === 0 ? (
              <EmptyState
                title="Rien de nouveau"
                description="Tu seras alerté dès qu'il y aura du mouvement."
                action={{
                  label: 'Centre de notifications',
                  href: '/app/creator/notifications',
                  variant: 'secondary',
                }}
              />
            ) : (
              <ul className="divide-y divide-border">
                {data.notifications.map((notification) => (
                  <li key={notification.id} className="flex items-start justify-between gap-3 py-3">
                    <div>
                      <p className="text-sm font-medium">{notificationTitle(notification.type)}</p>
                      <p className="text-xs text-muted-foreground">
                        {notification.content?.message || 'Nouvelle action disponible.'}
                      </p>
                    </div>
                    {!notification.read && (
                      <Badge variant="info" className="flex items-center gap-1">
                        <Bell className="h-3 w-3" />
                        Nouveau
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Actions rapides</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button asChild variant="secondary" className="justify-start gap-2">
              <Link href="/app/creator/submissions">
                <ListVideo className="h-4 w-4" />
                Mes soumissions
              </Link>
            </Button>
            <Button asChild variant="secondary" className="justify-start gap-2">
              <Link href="/app/creator/wallet">
                <Wallet2 className="h-4 w-4" />
                Voir mes gains
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {data.recommended.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Concours recommandés</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {data.recommended.map((contest) => (
                <RecommendedContestCard key={contest.id} contest={contest} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Progression</CardTitle>
          </CardHeader>
          <CardContent>
            <ProgressSteps steps={milestones} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            <CardTitle>Conseils</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {tips.map((tip) => (
              <div key={tip} className="text-sm text-muted-foreground">
                • {tip}
              </div>
            ))}
            <div className="rounded-xl border border-dashed border-border p-3 space-y-2 text-sm">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <Info className="h-4 w-4 text-primary" />
                Pourquoi je ne vois pas de concours ?
              </div>
              <ul className="list-disc pl-4 text-muted-foreground space-y-1 text-xs">
                <li>Vérifie tes filtres (statut, plateformes) sur la page Concours.</li>
                <li>Complète ton profil (plateforme principale, followers, vues moyennes).</li>
                <li>Certains concours sont limités par réseau ou par seuils.</li>
              </ul>
              <Button asChild variant="secondary" size="sm">
                <Link href="/app/creator/contests">Retirer les filtres</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

interface DashboardData {
  stats: {
    submissions_count: number;
    approved_submissions: number;
    total_earnings_cents: number;
    unread_notifications: number;
    views_total: number;
  };
  next_contest: {
    id: string;
    title: string;
    prize_pool_cents: number;
    end_at: string;
    currency: string;
  } | null;
  next_contest_can_submit: boolean;
  profileIncomplete: boolean;
  notifications: {
    id: string;
    type: string;
    content: Record<string, string>;
    read: boolean;
    created_at: string;
  }[];
  recommended: RecommendedContest[];
}

async function fetchDashboardData(
  userId: string,
): Promise<{ data?: DashboardData; error?: string }> {
  try {
    const supabase = await getSupabaseSSR();
    const now = new Date().toISOString();

    const { data: summary, error: summaryError } = await supabase
      .from('creator_dashboard_summary')
      .select('total_submissions, approved_submissions, total_views, total_earnings_cents')
      .eq('creator_id', userId)
      .maybeSingle();

    if (summaryError) {
      console.error('Dashboard summary error', summaryError);
    }

    const { data: nextContest } = await supabase
      .from('contests')
      .select('id, title, prize_pool_cents, currency, end_at')
      .eq('status', 'active')
      .gte('end_at', now)
      .order('end_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    const { data: notifications } = await supabase
      .from('notifications')
      .select('id, type, content, read, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    const unread_notifications = notifications?.filter((n) => !n.read).length || 0;

    const { data: profileCreator } = await supabase
      .from('profile_creators')
      .select('primary_platform, followers, avg_views')
      .eq('user_id', userId)
      .maybeSingle();

    const { data: canSubmitRes, error: canSubmitErr } =
      nextContest?.id
        ? await supabase.rpc('can_submit_to_contest', {
            p_contest_id: nextContest.id,
            p_user_id: userId,
          })
        : { data: null, error: null };

    if (canSubmitErr) {
      console.error('can_submit_to_contest error', canSubmitErr);
    }

    const recommended = await fetchRecommendedContests({
      primaryPlatform: profileCreator?.primary_platform || null,
      followers: profileCreator?.followers ?? null,
      avgViews: profileCreator?.avg_views ?? null,
    });

    return {
      data: {
        stats: {
          submissions_count: summary?.total_submissions ?? 0,
          approved_submissions: summary?.approved_submissions ?? 0,
          total_earnings_cents: summary?.total_earnings_cents ?? 0,
          unread_notifications,
          views_total: summary?.total_views ?? 0,
        },
        next_contest: nextContest
          ? {
              id: nextContest.id,
              title: nextContest.title,
              prize_pool_cents: nextContest.prize_pool_cents,
              currency: nextContest.currency || 'EUR',
              end_at: nextContest.end_at,
            }
          : null,
        next_contest_can_submit: Boolean(canSubmitRes),
        profileIncomplete: !profileCreator?.primary_platform,
        notifications: notifications || [],
        recommended,
      },
    };
  } catch (err) {
    console.error('Dashboard load error', err);
    return {
      error: 'Impossible de charger le dashboard. Réessaie plus tard ou contacte le support.',
    };
  }
}

type RecommendedContest = {
  id: string;
  title: string;
  end_at: string;
  prize_pool_cents: number;
  currency: string;
  networks: string[];
};

async function fetchRecommendedContests({
  primaryPlatform,
  followers,
  avgViews,
  limit = 3,
}: {
  primaryPlatform: string | null;
  followers: number | null;
  avgViews: number | null;
  limit?: number;
}): Promise<RecommendedContest[]> {
  const supabase = await getSupabaseSSR();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('contests')
    .select('id, title, end_at, prize_pool_cents, currency, networks')
    .eq('status', 'active')
    .gte('end_at', now)
    .order('end_at', { ascending: true })
    .limit(30);

  if (error) {
    console.error('Recommended contests fetch error', (error as any)?.message ?? error);
    return [];
  }

  const followerCount = followers ?? 0;
  const avgViewsCount = avgViews ?? 0;
  const platform = primaryPlatform ?? null;

  const eligible = (data || []).filter((contest) => {
    const matchesPlatform = !platform || (contest.networks || []).includes(platform);
    // Ici on pourrait plus tard filtrer par min_followers / min_views si nécessaire
    void followerCount;
    void avgViewsCount;
    return matchesPlatform;
  });

  return eligible.slice(0, limit).map((contest) => ({
    id: contest.id,
    title: contest.title,
    end_at: contest.end_at,
    prize_pool_cents: contest.prize_pool_cents,
    currency: contest.currency || 'EUR',
    networks: (contest.networks as string[]) || [],
  }));
}

function notificationTitle(type: string) {
  switch (type) {
    case 'submission_approved':
      return 'Ta participation est acceptée';
    case 'submission_rejected':
      return 'Ta participation est refusée';
    case 'contest_ending_soon':
      return 'Concours bientôt terminé';
    case 'cashout_completed':
      return 'Retrait effectué';
    default:
      return 'Notification';
  }
}

function RecommendedContestCard({ contest }: { contest: RecommendedContest }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
      <div>
        <p className="text-sm font-semibold text-foreground line-clamp-2">{contest.title}</p>
        <p className="text-xs text-muted-foreground">
          Fin le {new Date(contest.end_at).toLocaleDateString('fr-FR')}
        </p>
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
      <Button asChild size="sm" variant="secondary" className="justify-center">
        <Link href={`/app/creator/contests/${contest.id}`}>Voir le concours</Link>
      </Button>
    </div>
  );
}

function computeCountdown(endAt: string) {
  const now = Date.now();
  const end = new Date(endAt).getTime();
  const diffMs = Math.max(0, end - now);
  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return {
    label: diffMs === 0 ? 'Terminé' : days > 0 ? `Se termine dans ${days}j` : `Dans ${hours}h`,
    short: diffMs === 0 ? 'Terminé' : days > 0 ? `${days}j ${hours}h` : `${hours}h`,
  };
}

function buildTodoList({
  profileIncomplete,
  hasSubmissions,
  hasUnread,
  nextContest,
  canSubmitNext,
  hasEarnings,
}: {
  profileIncomplete: boolean;
  hasSubmissions: boolean;
  hasUnread: boolean;
  nextContest: DashboardData['next_contest'];
  canSubmitNext: boolean;
  hasEarnings: boolean;
}) {
  const items: Array<{
    title: string;
    description?: string;
    label: string;
    variant: 'warning' | 'info' | 'success' | 'secondary';
  }> = [];

  if (profileIncomplete) {
    items.push({
      title: 'Compléter mon profil',
      description: 'Ajoute ta plateforme principale pour débloquer tous les concours.',
      label: 'Profil',
      variant: 'warning',
    });
  }

  if (!hasSubmissions && nextContest) {
    items.push({
      title: 'Soumettre ma première vidéo',
      description: nextContest.title,
      label: 'Action',
      variant: 'info',
    });
  }

  if (hasUnread) {
    items.push({
      title: 'Lire mes notifications',
      description: 'Modération, gains, messages.',
      label: 'Notifications',
      variant: 'info',
    });
  }

  if (nextContest && !canSubmitNext) {
    items.push({
      title: 'Vérifier l’éligibilité',
      description: 'Plateformes / seuils du concours en cours.',
      label: 'Concours',
      variant: 'warning',
    });
  }

  if (hasEarnings) {
    items.push({
      title: 'Consulter mes gains',
      description: 'Planifie tes retraits dans Wallet.',
      label: 'Gains',
      variant: 'secondary',
    });
  }

  return items;
}

