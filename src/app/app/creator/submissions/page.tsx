import Link from 'next/link';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { getSession } from '@/lib/auth';
import { SubmissionsTable, type SubmissionData } from '@/components/submission/submissions-table';
import { EmptyState } from '@/components/creator/empty-state';
import { Badge } from '@/components/ui/badge';
import { TrackOnView } from '@/components/analytics/track-once';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

const PAGE_SIZE = 20;

const STATUS_FILTERS = [
  { value: 'all', label: 'Toutes' },
  { value: 'pending', label: 'En attente' },
  { value: 'approved', label: 'En compétition' },
  { value: 'rejected', label: 'Refusées' },
];

export default async function SubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user } = await getSession();
  if (!user) return null;

  const supabase = await getSupabaseSSR();
  const params = await searchParams;

  const statusParam = typeof params.status === 'string' ? params.status : 'all';
  const contestParam = typeof params.contest === 'string' ? params.contest : '';
  const searchParam = typeof params.search === 'string' ? params.search.slice(0, 80) : '';
  const pageParam = Number(params.page);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;

  const { submissions, total, contests, error } = await getSubmissions(user.id, {
    status: statusParam,
    contestId: contestParam,
    search: searchParam,
    page,
    pageSize: PAGE_SIZE,
  });
  const stats = buildStats(submissions);

  const { data: profile } = await supabase
    .from('profile_creators')
    .select('primary_platform')
    .eq('user_id', user.id)
    .maybeSingle();
  const profileIncomplete = !profile?.primary_platform;

  if (error) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <EmptyState
          title="Erreur de chargement"
          description={error}
          action={{ label: 'Réessayer', href: '/app/creator/submissions' }}
        />
      </main>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="space-y-6 animate-fadeUpSoft">
      <TrackOnView
        event="view_submissions"
        payload={{
          total,
          page,
          status: statusParam,
          has_search: Boolean(searchParam),
          has_contest_filter: Boolean(contestParam),
        }}
      />

      <section className="rounded-3xl border border-border bg-card/60 p-6 shadow-card">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Suivi des participations</p>
            <h1 className="text-3xl font-semibold">Mes soumissions</h1>
            <p className="text-muted-foreground">
              Vérifie ton statut, tes vues et relance un concours en un clic.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/app/creator/contests">Découvrir les concours</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/app/creator/wallet">Voir mes gains</Link>
            </Button>
          </div>
        </div>
      </section>

      <section>
        <Card className="border-dashed border-border/70 bg-card/60">
          <CardContent className="py-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground text-sm">Comprendre les statuts</p>
            <p>
              <span className="font-semibold">En attente</span> : soumission reçue, en cours de modération.
            </p>
            <p>
              <span className="font-semibold">En compétition</span> : soumission approuvée et prise en compte
              dans le classement.
            </p>
            <p>
              <span className="font-semibold">Refusée</span> : soumission non conforme (raison indiquée si
              fournie).
            </p>
            <p>
              <span className="font-semibold">Retirée</span> : soumission annulée ou retirée du concours.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <StatCard title="Total" value={stats.total} />
        <StatCard title="En attente" value={stats.pending} />
        <StatCard title="En compétition" value={stats.approved} />
        <StatCard title="Refusées" value={stats.rejected} />
      </section>

      <div className="flex flex-wrap items-center gap-3 sticky top-16 z-10 bg-background/80 backdrop-blur py-2">
        {STATUS_FILTERS.map((f) => {
          const active = (statusParam || 'all') === f.value;
          const url = new URLSearchParams({
            ...(contestParam && { contest: contestParam }),
            ...(page > 1 && { page: String(page) }),
            ...(searchParam && { search: searchParam }),
          });
          if (f.value !== 'all') url.set('status', f.value);
          return (
            <Link
              key={f.value}
              href={`?${url.toString()}`}
              className={`text-sm px-3 py-1.5 rounded-full border transition ${
                active
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {f.label}
            </Link>
          );
        })}

        <form className="flex items-center gap-2" method="get">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              name="search"
              defaultValue={searchParam}
              placeholder="Rechercher par titre..."
              className="pl-8"
            />
          </div>
          <input type="hidden" name="status" value={statusParam} />
          {contestParam && <input type="hidden" name="contest" value={contestParam} />}
          <Button type="submit" size="sm">
            Filtrer
          </Button>
        </form>

        {contests.length > 0 && (
          <form className="ml-auto flex items-center gap-2" method="get">
            <label className="text-sm text-muted-foreground" htmlFor="contest-select">
              Concours
            </label>
            <select
              id="contest-select"
              name="contest"
              defaultValue={contestParam}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              onChange={(e) => e.currentTarget.form?.submit()}
            >
              <option value="">Tous</option>
              {contests.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
            <input type="hidden" name="status" value={statusParam} />
            {searchParam && <input type="hidden" name="search" value={searchParam} />}
          </form>
        )}
      </div>

      {submissions.length === 0 ? (
        <EmptyState
          title="Aucune participation pour l'instant"
          description={
            profileIncomplete
              ? 'Complète ton profil pour débloquer plus de concours.'
              : 'Choisis un concours actif et dépose ta première vidéo.'
          }
          action={{ label: 'Trouver un concours', href: '/app/creator/contests' }}
        />
      ) : (
        <SubmissionsTable submissions={submissions} />
      )}

      {totalPages > 1 && (
        <nav
          className="flex items-center justify-between border-t border-border pt-4 text-sm text-muted-foreground"
          aria-label="Pagination"
        >
          <Link
            href={buildUrl({
              status: statusParam,
              contest: contestParam,
              search: searchParam,
              page: page > 1 ? page - 1 : 1,
            })}
            className={`hover:text-foreground ${page <= 1 ? 'pointer-events-none opacity-50' : ''}`}
          >
            Précédent
          </Link>
          <Badge variant="default">
            Page {page} / {totalPages}
          </Badge>
          <Link
            href={buildUrl({
              status: statusParam,
              contest: contestParam,
              search: searchParam,
              page: page < totalPages ? page + 1 : totalPages,
            })}
            className={`hover:text-foreground ${page >= totalPages ? 'pointer-events-none opacity-50' : ''}`}
          >
            Suivant
          </Link>
        </nav>
      )}
    </main>
  );
}

async function getSubmissions(
  userId: string,
  opts: { status: string; contestId: string; search: string; page: number; pageSize: number },
): Promise<{ submissions: SubmissionData[]; total: number; contests: { id: string; title: string }[]; error?: string }> {
  const supabase = await getSupabaseSSR();
  const from = (opts.page - 1) * opts.pageSize;
  const to = from + opts.pageSize - 1;

  // Optional search by contest title: resolve matching contest_ids first
  let contestIdsFilter: string[] | null = null;
  if (opts.search) {
    const sanitizedSearch = opts.search.replace(/%/g, '');
    const { data: contestsSearch, error: contestsSearchError } = await supabase
      .from('contests')
      .select('id, title')
      .ilike('title', `%${sanitizedSearch}%`);

    if (contestsSearchError) {
      console.error('Error searching contests for submissions:', contestsSearchError);
      return {
        submissions: [],
        total: 0,
        contests: [],
        error: 'Impossible de charger tes soumissions. Réessaie plus tard ou contacte le support.',
      };
    }

    contestIdsFilter = (contestsSearch || []).map((c) => c.id as string);

    if (!contestIdsFilter.length) {
      // No contest matches the search: short‑circuit with empty result
      return { submissions: [], total: 0, contests: [], error: undefined };
    }
  }

  let query = supabase
    .from('submissions')
    .select(
      `
      id,
      contest_id,
      platform,
      external_url,
      status,
      rejection_reason,
      submitted_at,
      approved_at
    `,
      { count: 'exact' },
    )
    .eq('creator_id', userId)
    .order('submitted_at', { ascending: false });

  if (opts.status && opts.status !== 'all') {
    query = query.eq('status', opts.status);
  }
  if (opts.contestId) {
    query = query.eq('contest_id', opts.contestId);
  }
  if (contestIdsFilter) {
    query = query.in('contest_id', contestIdsFilter);
  }

  const { data, count, error } = await query.range(from, to);
  if (error) {
    console.error('Error fetching submissions:', error);
    return {
      submissions: [],
      total: 0,
      contests: [],
      error: 'Impossible de charger tes soumissions. Réessaie plus tard ou contacte le support.',
    };
  }

  const submissionIds = (data || []).map((row) => row.id);
  const metricMap = new Map<string, { views: number; likes: number }>();
  if (submissionIds.length > 0) {
    const { data: metrics, error: metricsError } = await supabase
      .from('metrics_daily')
      .select('submission_id, views, likes')
      .in('submission_id', submissionIds);
    if (metricsError) {
      console.error('Error fetching metrics:', metricsError);
    }
    metrics?.forEach((m) => {
      const current = metricMap.get(m.submission_id) || { views: 0, likes: 0 };
      metricMap.set(m.submission_id, {
        views: current.views + (m.views || 0),
        likes: current.likes + (m.likes || 0),
      });
    });
  }

  // Fetch contest titles for the contests referenced by these submissions
  const contestIds = Array.from(new Set((data || []).map((row) => row.contest_id as string)));
  let contests: { id: string; title: string }[] = [];
  const contestTitleMap = new Map<string, string>();

  if (contestIds.length > 0) {
    const { data: contestsData, error: contestsError } = await supabase
      .from('contests')
      .select('id, title')
      .in('id', contestIds);

    if (contestsError) {
      console.error('Error fetching contests for submissions:', contestsError);
    }

    contests = (contestsData || []).map((c) => ({ id: c.id as string, title: (c.title as string) || 'Concours' }));
    contests.forEach((c) => contestTitleMap.set(c.id, c.title));
  }

  return {
    submissions:
      data?.map((submission) => ({
        id: submission.id,
        contest_id: submission.contest_id,
        contest_title: contestTitleMap.get(submission.contest_id as string) || 'Concours inconnu',
        platform: submission.platform as SubmissionData['platform'],
        external_url: submission.external_url,
        caption: null,
        status: submission.status as SubmissionData['status'],
        rejection_reason: submission.rejection_reason,
        submitted_at: submission.submitted_at,
        approved_at: submission.approved_at,
        views: metricMap.get(submission.id)?.views ?? null,
        likes: metricMap.get(submission.id)?.likes ?? null,
      })) || [],
    total: count || 0,
    contests,
  };
}

function buildUrl(params: { status?: string; contest?: string; search?: string; page?: number }) {
  const sp = new URLSearchParams();
  if (params.status && params.status !== 'all') sp.set('status', params.status);
  if (params.contest) sp.set('contest', params.contest);
  if (params.search) sp.set('search', params.search);
  if (params.page && params.page > 1) sp.set('page', String(params.page));
  return `?${sp.toString()}`;
}

function buildStats(submissions: SubmissionData[]) {
  const total = submissions.length;
  return {
    total,
    pending: submissions.filter((s) => s.status === 'pending').length,
    approved: submissions.filter((s) => s.status === 'approved').length,
    rejected: submissions.filter((s) => s.status === 'rejected').length,
  };
}

function StatCard({ title, value }: { title: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <p className="text-sm text-muted-foreground">{title}</p>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
