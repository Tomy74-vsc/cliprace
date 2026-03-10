/*
Page: Brand contest submissions moderation
Objectifs: liste des soumissions avec filtres (statut, plateforme, tri), actions modération (approuver/refuser)
*/
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BrandEmptyState } from '@/components/brand/empty-state-enhanced';
import { ArrowLeft, Filter, Search } from 'lucide-react';
import { TrackOnView } from '@/components/analytics/track-once';
import { PlatformBadge } from '@/components/creator/platform-badge';
import { SubmissionsModerationTable } from '@/components/brand/submissions-moderation-table';
import { SubmissionsReviewView } from '@/components/brand/submissions-review-view';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Platform } from '@/lib/validators/platforms';
import {
  FocusModerationLauncher,
  type FocusModerationSubmission,
} from '@/components/brand/moderation/FocusModeration';
import { ReviewingBanner } from '@/components/brand/reviewing-banner';

const PAGE_SIZE = 20;
const STATUS_VALUES = ['all', 'pending', 'approved', 'rejected'] as const;
const PLATFORM_VALUES: Platform[] = ['tiktok', 'instagram', 'youtube'];
const SORT_VALUES = ['newest', 'oldest', 'views_desc', 'views_asc'] as const;

export const revalidate = 60;

interface SubmissionsPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function BrandContestSubmissionsPage({
  params,
  searchParams,
}: SubmissionsPageProps) {
  const { user } = await getSession();
  if (!user) return null;

  const { id } = await params;
  const paramsData = await searchParams;

  // Vérifier que le concours appartient à la marque
  const supabase = await getSupabaseSSR();
  const { data: contest, error: contestError } = await supabase
    .from('contests')
    .select('id, title, brand_id, status, ends_at')
    .eq('id', id)
    .eq('brand_id', user.id)
    .maybeSingle();

  if (contestError || !contest) {
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

  // Récupérer les paramètres de filtres
  const statusParam =
    typeof paramsData.status === 'string' && STATUS_VALUES.includes(paramsData.status as (typeof STATUS_VALUES)[number])
      ? (paramsData.status as (typeof STATUS_VALUES)[number])
      : 'all';

  const platformsParam = typeof paramsData.platforms === 'string' ? paramsData.platforms : '';
  const selectedPlatforms = platformsParam
    ? platformsParam
        .split(',')
        .map((p) => p.trim())
        .filter((p): p is Platform => PLATFORM_VALUES.includes(p as Platform))
    : [];

  const sortParam =
    typeof paramsData.sort === 'string' && SORT_VALUES.includes(paramsData.sort as (typeof SORT_VALUES)[number])
      ? (paramsData.sort as (typeof SORT_VALUES)[number])
      : 'newest';

  const searchParam = typeof paramsData.search === 'string' ? paramsData.search.slice(0, 80) : '';
  const pageParam = Number(paramsData.page);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;

  // Récupérer les soumissions
  const { submissions, total, stats } = await fetchSubmissions({
    contestId: id,
    status: statusParam,
    platforms: selectedPlatforms,
    sort: sortParam,
    search: searchParam,
    page,
    pageSize: PAGE_SIZE,
  });

  const focusParam = paramsData.focus;
  const focusInitialOpen =
    (typeof focusParam === 'string' && (focusParam === '1' || focusParam === 'true')) ||
    (Array.isArray(focusParam) && focusParam.includes('1'));

  return (
    <main className="space-y-8">
      <TrackOnView
        event="view_brand_submissions"
        payload={{ contest_id: id, status: statusParam, total }}
      />

      {contest.status === 'reviewing' && (
        <ReviewingBanner
          contestId={id}
          endsAt={contest.ends_at ?? null}
          pendingCount={stats.pending}
        />
      )}

      {/* En-tête */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href={`/app/brand/contests/${id}`}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour au concours
              </Link>
            </Button>
          </div>
          <h1 className="text-3xl font-semibold">Modération des soumissions</h1>
          <p className="text-muted-foreground">
            {contest.title} • {total} soumission{total > 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <FocusModerationLauncher
            contestId={id}
            submissions={submissions as FocusModerationSubmission[]}
            initialOpen={focusInitialOpen}
          />
        </div>
      </div>

      {/* Stats rapides */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">En attente</p>
                <p className="text-2xl font-semibold text-warning">{stats.pending}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approuvées</p>
                <p className="text-2xl font-semibold text-success">{stats.approved}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Refusées</p>
                <p className="text-2xl font-semibold text-destructive">{stats.rejected}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-semibold">{total}</p>
              </div>
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
            <form method="get" action={`/app/brand/contests/${id}/submissions`}>
              <input
                name="search"
                type="text"
                placeholder="Rechercher par créateur ou URL..."
                defaultValue={searchParam}
                className="flex w-full rounded-xl border border-input bg-background px-4 py-3 pl-9 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
              {/* Préserver les autres paramètres */}
              {statusParam !== 'all' && <input type="hidden" name="status" value={statusParam} />}
              {selectedPlatforms.length > 0 && (
                <input type="hidden" name="platforms" value={selectedPlatforms.join(',')} />
              )}
              {sortParam !== 'newest' && <input type="hidden" name="sort" value={sortParam} />}
            </form>
          </div>

          {/* Filtres statut */}
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-muted-foreground self-center">Statut:</span>
            {STATUS_VALUES.map((status) => {
              const url = new URLSearchParams();
              if (status !== 'all') url.set('status', status);
              if (searchParam) url.set('search', searchParam);
              if (selectedPlatforms.length > 0) url.set('platforms', selectedPlatforms.join(','));
              if (sortParam !== 'newest') url.set('sort', sortParam);
              return (
                <Button
                  key={status}
                  asChild
                  variant={statusParam === status ? 'primary' : 'secondary'}
                  size="sm"
                >
                  <Link href={`/app/brand/contests/${id}/submissions?${url.toString()}`}>
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
              if (searchParam) url.set('search', searchParam);
              if (newPlatforms.length > 0) url.set('platforms', newPlatforms.join(','));
              if (sortParam !== 'newest') url.set('sort', sortParam);
              return (
                <Button
                  key={platform}
                  asChild
                  variant={isSelected ? 'primary' : 'secondary'}
                  size="sm"
                >
                  <Link href={`/app/brand/contests/${id}/submissions?${url.toString()}`}>
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
              if (searchParam) url.set('search', searchParam);
              if (selectedPlatforms.length > 0) url.set('platforms', selectedPlatforms.join(','));
              if (sort !== 'newest') url.set('sort', sort);
              return (
                <Button
                  key={sort}
                  asChild
                  variant={sortParam === sort ? 'primary' : 'secondary'}
                  size="sm"
                >
                  <Link href={`/app/brand/contests/${id}/submissions?${url.toString()}`}>
                    {sortLabels[sort]}
                  </Link>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Toggle vue simple / table */}
      <Tabs defaultValue="review" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
          <TabsTrigger value="review">Vue simple</TabsTrigger>
          <TabsTrigger value="table">Vue tableau avancé</TabsTrigger>
        </TabsList>

        <TabsContent value="review" className="space-y-4">
          {submissions.length === 0 ? (
            <BrandEmptyState
              type="no-results"
              title="Aucune soumission trouvée"
              description="Aucune soumission ne correspond à tes filtres."
              action={{
                label: 'Retirer les filtres',
                href: `/app/brand/contests/${id}/submissions`,
                variant: 'secondary',
              }}
            />
          ) : (
            <SubmissionsReviewView submissions={submissions} contestId={id} />
          )}
        </TabsContent>

        <TabsContent value="table" className="space-y-4">
          {submissions.length === 0 ? (
            <BrandEmptyState
              type="no-results"
              title="Aucune soumission trouvée"
              description="Aucune soumission ne correspond à tes filtres."
              action={{
                label: 'Retirer les filtres',
                href: `/app/brand/contests/${id}/submissions`,
                variant: 'secondary',
              }}
            />
          ) : (
            <SubmissionsModerationTable submissions={submissions} contestId={id} />
          )}
        </TabsContent>
      </Tabs>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <Button asChild variant="secondary" size="sm">
              <Link
                href={`/app/brand/contests/${id}/submissions?page=${page - 1}${statusParam !== 'all' ? `&status=${statusParam}` : ''}${searchParam ? `&search=${encodeURIComponent(searchParam)}` : ''}${selectedPlatforms.length > 0 ? `&platforms=${selectedPlatforms.join(',')}` : ''}${sortParam !== 'newest' ? `&sort=${sortParam}` : ''}`}
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
                href={`/app/brand/contests/${id}/submissions?page=${page + 1}${statusParam !== 'all' ? `&status=${statusParam}` : ''}${searchParam ? `&search=${encodeURIComponent(searchParam)}` : ''}${selectedPlatforms.length > 0 ? `&platforms=${selectedPlatforms.join(',')}` : ''}${sortParam !== 'newest' ? `&sort=${sortParam}` : ''}`}
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
  all: 'Toutes',
  pending: 'En attente',
  approved: 'Approuvées',
  rejected: 'Refusées',
};

const sortLabels: Record<string, string> = {
  newest: 'Plus récentes',
  oldest: 'Plus anciennes',
  views_desc: 'Plus de vues',
  views_asc: 'Moins de vues',
};

async function fetchSubmissions({
  contestId,
  status,
  platforms,
  sort,
  search,
  page,
  pageSize,
}: {
  contestId: string;
  status: (typeof STATUS_VALUES)[number];
  platforms: Platform[];
  sort: (typeof SORT_VALUES)[number];
  search: string;
  page: number;
  pageSize: number;
}) {
  const supabase = await getSupabaseSSR();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('submissions')
    .select(
      'id, external_url, platform, status, rejection_reason, submitted_at, approved_at, creator_id, creator:creator_id(display_name)',
      { count: 'exact' }
    )
    .eq('contest_id', contestId);

  // Filtre par statut
  if (status !== 'all') {
    query = query.eq('status', status);
  }

  // Filtre par plateformes
  if (platforms.length > 0) {
    query = query.in('platform', platforms);
  }

  // Recherche
  if (search) {
    query = query.or(`external_url.ilike.%${search}%,creator:creator_id.display_name.ilike.%${search}%`);
  }

  // Tri
  switch (sort) {
    case 'newest':
      query = query.order('submitted_at', { ascending: false });
      break;
    case 'oldest':
      query = query.order('submitted_at', { ascending: true });
      break;
    case 'views_desc':
    case 'views_asc':
      // Pour trier par vues, on devra faire un tri côté client après avoir récupéré les métriques
      query = query.order('submitted_at', { ascending: false });
      break;
  }

  const { data: submissionsData, count, error } = await query.range(from, to);

  if (error) {
    console.error('Submissions fetch error', error);
    return { submissions: [], total: 0, stats: { pending: 0, approved: 0, rejected: 0 } };
  }

  // Récupérer les stats globales
  const { data: allSubmissions } = await supabase
    .from('submissions')
    .select('status')
    .eq('contest_id', contestId);

  const stats = {
    pending: allSubmissions?.filter((s) => s.status === 'pending').length || 0,
    approved: allSubmissions?.filter((s) => s.status === 'approved').length || 0,
    rejected: allSubmissions?.filter((s) => s.status === 'rejected').length || 0,
  };

  // Récupérer les métriques pour chaque soumission
  const submissionIds = submissionsData?.map((s) => s.id) || [];
  const { data: metrics } = submissionIds.length > 0
    ? await supabase
        .from('metrics_daily')
        .select('submission_id, views, likes')
        .in('submission_id', submissionIds)
    : { data: null };

  const metricsBySubmission = new Map<string, { views: number; likes: number }>();
  metrics?.forEach((m: { submission_id: string; views: number; likes: number }) => {
    const current = metricsBySubmission.get(m.submission_id) || { views: 0, likes: 0 };
    metricsBySubmission.set(m.submission_id, {
      views: current.views + (m.views || 0),
      likes: current.likes + (m.likes || 0),
    });
  });

  // Construire les soumissions avec métriques
  const submissions = (submissionsData || []).map((submission) => {
    const submissionMetrics = metricsBySubmission.get(submission.id) || { views: 0, likes: 0 };
    return {
      id: submission.id,
      external_url: submission.external_url,
      platform: submission.platform as Platform,
      status: submission.status as 'pending' | 'approved' | 'rejected',
      rejection_reason: submission.rejection_reason,
      submitted_at: submission.submitted_at,
      approved_at: submission.approved_at,
      creator_id: submission.creator_id,
      creator_name: (submission.creator as { display_name?: string | null } | null)?.display_name || null,
      views: submissionMetrics.views,
      likes: submissionMetrics.likes,
    };
  });

  // Tri par vues si demandé
  if (sort === 'views_desc' || sort === 'views_asc') {
    submissions.sort((a, b) => {
      return sort === 'views_desc' ? b.views - a.views : a.views - b.views;
    });
  }

  return {
    submissions,
    total: count || 0,
    stats,
  };
}

