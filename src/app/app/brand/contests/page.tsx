/*
Page: Brand contests list
Objectifs: liste des concours de la marque avec filtres (statut, plateforme, période), actions rapides.
*/
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BrandEmptyState } from '@/components/brand/empty-state-enhanced';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { Plus, Trophy, Clock, CheckCircle2, FileText, Archive, Search, Filter } from 'lucide-react';
import { TrackOnView } from '@/components/analytics/track-once';
import { PlatformBadge } from '@/components/creator/platform-badge';
import { Input } from '@/components/ui/input';
import type { Platform } from '@/lib/validators/platforms';

const PAGE_SIZE = 20;
const STATUS_VALUES = ['all', 'draft', 'active', 'ended', 'archived'] as const;
const PLATFORM_VALUES: Platform[] = ['tiktok', 'instagram', 'youtube'];
const SORT_VALUES = ['newest', 'oldest', 'prize_desc', 'submissions_desc'] as const;

export const revalidate = 60;

interface ContestsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function BrandContestsPage({ searchParams }: ContestsPageProps) {
  const { user } = await getSession();
  if (!user) return null;

  const params = await searchParams;

  const search = typeof params.search === 'string' ? params.search.slice(0, 80) : '';
  const rawStatus = typeof params.status === 'string' ? params.status : null;
  const statusParam: (typeof STATUS_VALUES)[number] = STATUS_VALUES.includes(
    rawStatus as (typeof STATUS_VALUES)[number],
  )
    ? (rawStatus as (typeof STATUS_VALUES)[number])
    : 'all';

  const platformsParam = typeof params.platforms === 'string' ? params.platforms : '';
  const selectedPlatforms = platformsParam
    ? platformsParam
        .split(',')
        .map((p) => p.trim())
        .filter((p): p is Platform => PLATFORM_VALUES.includes(p as Platform))
    : [];

  const rawSort = typeof params.sort === 'string' ? params.sort : null;
  const sortParam: (typeof SORT_VALUES)[number] = SORT_VALUES.includes(
    rawSort as (typeof SORT_VALUES)[number],
  )
    ? (rawSort as (typeof SORT_VALUES)[number])
    : 'newest';

  const currentPageRaw = Number(params.page);
  const page =
    Number.isFinite(currentPageRaw) && currentPageRaw > 0 ? Math.floor(currentPageRaw) : 1;

  const { contests, total, stats } = await fetchContests({
    userId: user.id,
    search,
    status: statusParam,
    platforms: selectedPlatforms,
    sort: sortParam,
    page,
    pageSize: PAGE_SIZE,
  });

  return (
    <main className="space-y-8">
      <TrackOnView event="view_brand_contests" payload={{ total, status: statusParam }} />

      {/* En-tête avec CTA */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold">Mes concours</h1>
          <p className="text-muted-foreground">
            Gère tes concours, modère les participations, suivez les performances.
          </p>
        </div>
        <Button asChild>
          <Link href="/app/brand/contests/new">
            <Plus className="h-4 w-4 mr-2" />
            Créer un concours
          </Link>
        </Button>
      </div>

      {/* Stats rapides */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="group transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover border-border/60 hover:border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground transition-colors duration-200 group-hover:text-foreground/80">Actifs</p>
                <p className="text-2xl font-semibold transition-colors duration-200 group-hover:text-primary">{stats.active}</p>
              </div>
              <Trophy className="h-8 w-8 text-primary transition-transform duration-200 group-hover:scale-110" />
            </div>
          </CardContent>
        </Card>
        <Card className="group transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover border-border/60 hover:border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground transition-colors duration-200 group-hover:text-foreground/80">Brouillons</p>
                <p className="text-2xl font-semibold transition-colors duration-200 group-hover:text-primary">{stats.draft}</p>
              </div>
              <FileText className="h-8 w-8 text-muted-foreground transition-transform duration-200 group-hover:scale-110" />
            </div>
          </CardContent>
        </Card>
        <Card className="group transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover border-border/60 hover:border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground transition-colors duration-200 group-hover:text-foreground/80">Terminés</p>
                <p className="text-2xl font-semibold transition-colors duration-200 group-hover:text-primary">{stats.ended}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-success transition-transform duration-200 group-hover:scale-110" />
            </div>
          </CardContent>
        </Card>
        <Card className="group transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover border-border/60 hover:border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground transition-colors duration-200 group-hover:text-foreground/80">Total</p>
                <p className="text-2xl font-semibold transition-colors duration-200 group-hover:text-primary">{total}</p>
              </div>
              <Archive className="h-8 w-8 text-muted-foreground transition-transform duration-200 group-hover:scale-110" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtres */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <CardTitle>Filtres</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Recherche */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <form method="get" action="/app/brand/contests">
              <Input
                name="search"
                placeholder="Rechercher un concours..."
                defaultValue={search}
                className="pl-9"
              />
              {/* Préserver les autres paramètres */}
              {statusParam !== 'all' && (
                <input type="hidden" name="status" value={statusParam} />
              )}
              {selectedPlatforms.length > 0 && (
                <input type="hidden" name="platforms" value={selectedPlatforms.join(',')} />
              )}
              {sortParam !== 'newest' && (
                <input type="hidden" name="sort" value={sortParam} />
              )}
            </form>
          </div>

          {/* Filtres statut */}
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-muted-foreground self-center">Statut:</span>
            {STATUS_VALUES.map((status) => {
              const url = new URLSearchParams();
              if (status !== 'all') url.set('status', status);
              if (search) url.set('search', search);
              if (selectedPlatforms.length > 0) url.set('platforms', selectedPlatforms.join(','));
              if (sortParam !== 'newest') url.set('sort', sortParam);
              return (
                <Button
                  key={status}
                  asChild
                  variant={statusParam === status ? 'primary' : 'secondary'}
                  size="sm"
                >
                  <Link href={`/app/brand/contests?${url.toString()}`}>
                    {statusLabels[status]}
                  </Link>
                </Button>
              );
            })}
          </div>

          {/* Filtres plateforme */}
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-muted-foreground self-center">Plateformes:</span>
            {PLATFORM_VALUES.map((platform) => {
              const isSelected = selectedPlatforms.includes(platform);
              const newPlatforms = isSelected
                ? selectedPlatforms.filter((p) => p !== platform)
                : [...selectedPlatforms, platform];
              const url = new URLSearchParams();
              if (statusParam !== 'all') url.set('status', statusParam);
              if (search) url.set('search', search);
              if (newPlatforms.length > 0) url.set('platforms', newPlatforms.join(','));
              if (sortParam !== 'newest') url.set('sort', sortParam);
              return (
                <Button
                  key={platform}
                  asChild
                  variant={isSelected ? 'primary' : 'secondary'}
                  size="sm"
                >
                  <Link href={`/app/brand/contests?${url.toString()}`}>
                    <PlatformBadge platform={platform} />
                  </Link>
                </Button>
              );
            })}
          </div>

          {/* Tri */}
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-muted-foreground self-center">Trier par:</span>
            {SORT_VALUES.map((sort) => {
              const url = new URLSearchParams();
              if (statusParam !== 'all') url.set('status', statusParam);
              if (search) url.set('search', search);
              if (selectedPlatforms.length > 0) url.set('platforms', selectedPlatforms.join(','));
              if (sort !== 'newest') url.set('sort', sort);
              return (
                <Button
                  key={sort}
                  asChild
                  variant={sortParam === sort ? 'primary' : 'secondary'}
                  size="sm"
                >
                  <Link href={`/app/brand/contests?${url.toString()}`}>{sortLabels[sort]}</Link>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Liste des concours */}
      {contests.length === 0 ? (
        <BrandEmptyState
          type={statusParam === 'draft' ? 'no-contests' : 'no-results'}
          title="Aucun concours trouvé"
          description={
            statusParam === 'draft'
              ? 'Crée ton premier concours pour commencer.'
              : 'Aucun concours ne correspond à tes filtres.'
          }
          action={
            statusParam === 'draft'
              ? {
                  label: 'Créer un concours',
                  href: '/app/brand/contests/new',
                  variant: 'primary',
                }
              : {
                  label: 'Voir tous les concours',
                  href: '/app/brand/contests',
                  variant: 'secondary',
                }
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {contests.map((contest) => (
            <ContestCard key={contest.id} contest={contest} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <Button asChild variant="secondary" size="sm">
              <Link
                href={`/app/brand/contests?page=${page - 1}${statusParam !== 'all' ? `&status=${statusParam}` : ''}${search ? `&search=${encodeURIComponent(search)}` : ''}${selectedPlatforms.length > 0 ? `&platforms=${selectedPlatforms.join(',')}` : ''}${sortParam !== 'newest' ? `&sort=${sortParam}` : ''}`}
              >
                Précédent
              </Link>
            </Button>
          )}
          <span className="text-sm text-muted-foreground">
            Page {page} sur {Math.ceil(total / PAGE_SIZE)}
          </span>
          {page < Math.ceil(total / PAGE_SIZE) && (
            <Button asChild variant="secondary" size="sm">
              <Link
                href={`/app/brand/contests?page=${page + 1}${statusParam !== 'all' ? `&status=${statusParam}` : ''}${search ? `&search=${encodeURIComponent(search)}` : ''}${selectedPlatforms.length > 0 ? `&platforms=${selectedPlatforms.join(',')}` : ''}${sortParam !== 'newest' ? `&sort=${sortParam}` : ''}`}
              >
                Suivant
              </Link>
            </Button>
          )}
        </div>
      )}
    </main>
  );
}

const statusLabels: Record<string, string> = {
  all: 'Tous',
  draft: 'Brouillons',
  active: 'Actifs',
  ended: 'Terminés',
  archived: 'Archivés',
};

const statusVariants: Record<string, 'secondary' | 'success' | 'warning' | 'info'> = {
  draft: 'secondary',
  active: 'success',
  ended: 'warning',
  archived: 'info',
};

const sortLabels: Record<string, string> = {
  newest: 'Plus récents',
  oldest: 'Plus anciens',
  prize_desc: 'Budget décroissant',
  submissions_desc: 'Plus de soumissions',
};

interface ContestCardProps {
  contest: {
    id: string;
    title: string;
    status: string;
    prize_pool_cents: number;
    currency: string;
    networks: string[];
    start_at: string;
    end_at: string;
    submissions_count: number;
    pending_submissions_count: number;
    views: number;
    created_at: string;
  };
}

function ContestCard({ contest }: ContestCardProps) {
  const isActive = contest.status === 'active';
  const isEnded = contest.status === 'ended';
  const now = new Date();
  const endDate = new Date(contest.end_at);
  const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <Card className="group transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover border-border/60 hover:border-primary/20">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg line-clamp-2">{contest.title}</CardTitle>
          <Badge variant={statusVariants[contest.status] || 'default'}>
            {statusLabels[contest.status] || contest.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Prize pool</span>
            <span className="font-semibold">
              {formatCurrency(contest.prize_pool_cents, contest.currency)}
            </span>
          </div>
          {contest.networks.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {contest.networks.slice(0, 3).map((network) => (
                <PlatformBadge key={network} platform={network as Platform} />
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {isActive && daysLeft > 0
              ? `Se termine dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}`
              : isEnded
                ? `Terminé le ${formatDate(contest.end_at)}`
                : `Démarre le ${formatDate(contest.start_at)}`}
          </div>
        </div>

        <div className="pt-2 border-t border-border space-y-2">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-muted-foreground">Soumissions</p>
              <p className="font-semibold">{contest.submissions_count}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Vues</p>
              <p className="font-semibold">{contest.views.toLocaleString()}</p>
            </div>
          </div>
          {contest.pending_submissions_count > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">En attente</span>
              <Badge variant="warning">{contest.pending_submissions_count}</Badge>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button asChild size="sm" variant="primary" className="flex-1">
            <Link href={`/app/brand/contests/${contest.id}`}>Voir</Link>
          </Button>
          {contest.pending_submissions_count > 0 && (
            <Button asChild size="sm" variant="secondary" className="flex-1">
              <Link href={`/app/brand/contests/${contest.id}/submissions`}>Modérer</Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

async function fetchContests({
  userId,
  search,
  status,
  platforms,
  sort,
  page,
  pageSize,
}: {
  userId: string;
  search: string;
  status: (typeof STATUS_VALUES)[number];
  platforms: Platform[];
  sort: (typeof SORT_VALUES)[number];
  page: number;
  pageSize: number;
}) {
  const supabase = await getSupabaseSSR();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('contests')
    .select('id, title, status, prize_pool_cents, currency, networks, start_at, end_at, created_at', {
      count: 'exact',
    })
    .eq('brand_id', userId);

  // Filtre par statut
  if (status !== 'all') {
    query = query.eq('status', status);
  }

  // Recherche
  if (search) {
    const sanitizedSearch = search.replace(/%/g, '');
    query = query.ilike('title', `%${sanitizedSearch}%`);
  }

  // Filtre par plateformes
  if (platforms.length > 0) {
    query = query.overlaps('networks', platforms);
  }

  // Pour le tri par soumissions, on doit d'abord récupérer tous les concours,
  // calculer les stats, trier, puis paginer
  const needsSubmissionsSort = sort === 'submissions_desc';
  
  if (!needsSubmissionsSort) {
    // Tri standard (sans soumissions)
    switch (sort) {
      case 'newest':
        query = query.order('created_at', { ascending: false });
        break;
      case 'oldest':
        query = query.order('created_at', { ascending: true });
        break;
      case 'prize_desc':
        query = query.order('prize_pool_cents', { ascending: false });
        break;
    }
  }

  // Récupérer tous les concours si tri par soumissions, sinon paginer directement
  let contests: any[] | null = null;
  let totalCount: number = 0;
  let queryError: any = null;

  if (needsSubmissionsSort) {
    // Récupérer tous les concours pour le tri par soumissions
    const { data, count, error } = await query;
    contests = data;
    totalCount = count || 0;
    queryError = error;
  } else {
    // Pagination normale
    const { data, count, error } = await query.range(from, to);
    contests = data;
    totalCount = count || 0;
    queryError = error;
  }

  if (queryError) {
    console.error('Contests fetch error', queryError);
    return { contests: [], total: 0, stats: { active: 0, draft: 0, ended: 0 } };
  }

  // Récupérer les stats globales
  const { data: allContests } = await supabase
    .from('contests')
    .select('status')
    .eq('brand_id', userId);

  const stats = {
    active: allContests?.filter((c) => c.status === 'active').length || 0,
    draft: allContests?.filter((c) => c.status === 'draft').length || 0,
    ended: allContests?.filter((c) => c.status === 'ended').length || 0,
  };

  // Récupérer le nombre de soumissions et vues par concours
  const contestIds = contests?.map((c) => c.id) || [];
  const submissionsData: Record<string, { total: number; pending: number; views: number }> = {};

  if (contestIds.length > 0) {
    // Soumissions
    const { data: submissions } = await supabase
      .from('submissions')
      .select('contest_id, status')
      .in('contest_id', contestIds);

    contestIds.forEach((id) => {
      const contestSubmissions = submissions?.filter((s) => s.contest_id === id) || [];
      submissionsData[id] = {
        total: contestSubmissions.length,
        pending: contestSubmissions.filter((s) => s.status === 'pending').length,
        views: 0, // Sera rempli par la requête suivante
      };
    });

    // Vues depuis metrics_daily
    const submissionIds = submissions?.map((s) => s.id) || [];
    if (submissionIds.length > 0) {
      const { data: metrics } = await supabase
        .from('metrics_daily')
        .select('submission_id, views')
        .in('submission_id', submissionIds);

      // Agréger les vues par concours
      const viewsByContest = new Map<string, number>();
      metrics?.forEach((m: { submission_id: string; views: number }) => {
        const submission = submissions?.find((s: any) => s.id === m.submission_id);
        if (submission) {
          const current = viewsByContest.get((submission as any).contest_id) || 0;
          viewsByContest.set((submission as any).contest_id, current + (m.views || 0));
        }
      });

      viewsByContest.forEach((views, contestId) => {
        if (submissionsData[contestId]) {
          submissionsData[contestId].views = views;
        }
      });
    }
  }

  const contestsWithStats = (contests || []).map((contest) => ({
    ...contest,
    submissions_count: submissionsData[contest.id]?.total || 0,
    pending_submissions_count: submissionsData[contest.id]?.pending || 0,
    views: submissionsData[contest.id]?.views || 0,
  }));

  // Tri par soumissions si demandé (sur tous les résultats)
  let sortedContests = contestsWithStats;
  if (sort === 'submissions_desc') {
    sortedContests = [...contestsWithStats].sort((a, b) => b.submissions_count - a.submissions_count);
  }

  // Appliquer la pagination si tri par soumissions
  const paginatedContests = needsSubmissionsSort
    ? sortedContests.slice(from, to + 1)
    : sortedContests;

  return {
    contests: paginatedContests,
    total: totalCount || sortedContests.length,
    stats,
  };
}
