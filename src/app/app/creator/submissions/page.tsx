/*
Page: Mes soumissions avec filtres statut/concours + pagination.
*/
import Link from 'next/link';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { getSession } from '@/lib/auth';
import { SubmissionsTable, type SubmissionData } from '@/components/submission/submissions-table';
import { EmptyState } from '@/components/creator/empty-state';
import { Badge } from '@/components/ui/badge';

const PAGE_SIZE = 10;
const STATUS_FILTERS = [
  { value: 'all', label: 'Toutes' },
  { value: 'pending', label: 'En attente' },
  { value: 'approved', label: 'En compétition' },
  { value: 'rejected', label: 'Refusées' },
];

export default async function SubmissionsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const { user } = await getSession();
  if (!user) return null;

  const statusParam = typeof searchParams.status === 'string' ? searchParams.status : 'all';
  const contestParam = typeof searchParams.contest === 'string' ? searchParams.contest : '';
  const pageParam = Number(searchParams.page);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;

  const { submissions, total, contests, error } = await getSubmissions(user.id, {
    status: statusParam,
    contestId: contestParam,
    page,
    pageSize: PAGE_SIZE,
  });

  if (error) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <EmptyState title="Erreur de chargement" description={error} action={{ label: 'Réessayer', href: '/app/creator/submissions' }} />
      </main>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="display-2 mb-1">Mes soumissions</h1>
        <p className="text-muted-foreground">Suivez l’état de vos participations aux concours</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {STATUS_FILTERS.map((f) => {
          const active = (statusParam || 'all') === f.value;
          const url = new URLSearchParams({ ...(contestParam && { contest: contestParam }), ...(page > 1 && { page: String(page) }) });
          if (f.value !== 'all') url.set('status', f.value);
          return (
            <Link
              key={f.value}
              href={`?${url.toString()}`}
              className={`text-sm px-3 py-1.5 rounded-full border transition ${
                active ? 'bg-primary/10 text-primary border-primary/30' : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {f.label}
            </Link>
          );
        })}

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
          </form>
        )}
      </div>

      {submissions.length === 0 ? (
        <EmptyState
          title="Aucune soumission"
          description="Participe à un concours pour voir tes soumissions ici."
          action={{ label: 'Voir les concours', href: '/app/creator/contests' }}
        />
      ) : (
        <SubmissionsTable submissions={submissions} />
      )}

      {totalPages > 1 && (
        <nav className="flex items-center justify-between border-t border-border pt-4 text-sm text-muted-foreground" aria-label="Pagination">
          <Link
            href={buildUrl({ status: statusParam, contest: contestParam, page: page > 1 ? page - 1 : 1 })}
            className={`hover:text-foreground ${page <= 1 ? 'pointer-events-none opacity-50' : ''}`}
          >
            Précédent
          </Link>
          <Badge variant="default">
            Page {page} / {totalPages}
          </Badge>
          <Link
            href={buildUrl({ status: statusParam, contest: contestParam, page: page < totalPages ? page + 1 : totalPages })}
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
  opts: { status: string; contestId: string; page: number; pageSize: number }
): Promise<{ submissions: SubmissionData[]; total: number; contests: { id: string; title: string }[]; error?: string }> {
  const supabase = getSupabaseSSR();
  const from = (opts.page - 1) * opts.pageSize;
  const to = from + opts.pageSize - 1;

  let query = supabase
    .from('submissions')
    .select(
      `
      id,
      contest_id,
      platform,
      external_url,
      caption,
      status,
      rejection_reason,
      submitted_at,
      approved_at,
      contest:contest_id ( title )
    `,
      { count: 'exact' }
    )
    .eq('creator_id', userId)
    .order('submitted_at', { ascending: false });

  if (opts.status && opts.status !== 'all') {
    query = query.eq('status', opts.status);
  }
  if (opts.contestId) {
    query = query.eq('contest_id', opts.contestId);
  }

  const { data, count, error } = await query.range(from, to);
  if (error) {
    console.error('Error fetching submissions:', error);
    return { submissions: [], total: 0, contests: [], error: 'Impossible de charger les soumissions.' };
  }

  // Fetch contests list for filter (distinct)
  const { data: contestsData } = await supabase
    .from('submissions')
    .select('contest_id, contest:contest_id ( title )')
    .eq('creator_id', userId);
  const contests = Array.from(
    new Map(
      (contestsData || []).map((c) => [
        c.contest_id,
        { id: c.contest_id as string, title: (c.contest as { title: string })?.title || 'Concours' },
      ])
    ).values()
  );

  return {
    submissions:
      data?.map((submission) => ({
        id: submission.id,
        contest_id: submission.contest_id,
        contest_title: (submission.contest as { title: string })?.title || 'Concours inconnu',
        platform: submission.platform as SubmissionData['platform'],
        external_url: submission.external_url,
        caption: submission.caption,
        status: submission.status as SubmissionData['status'],
        rejection_reason: submission.rejection_reason,
        submitted_at: submission.submitted_at,
        approved_at: submission.approved_at,
      })) || [],
    total: count || 0,
    contests,
  };
}

function buildUrl(params: { status?: string; contest?: string; page?: number }) {
  const sp = new URLSearchParams();
  if (params.status && params.status !== 'all') sp.set('status', params.status);
  if (params.contest) sp.set('contest', params.contest);
  if (params.page && params.page > 1) sp.set('page', String(params.page));
  return `?${sp.toString()}`;
}
