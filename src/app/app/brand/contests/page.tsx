import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getContestsList } from './_data';
import type { ContestsFilters } from './_types';
import { ContestsFilters as FiltersBar } from './_components/contests-filters';
import { ContestsTable } from './_components/contests-table';
import { ContestsEmpty } from './_components/contests-empty';

export const revalidate = 60;

function parseFilters(searchParams: URLSearchParams): ContestsFilters {
  const search = searchParams.get('search') ?? '';
  const statusParam = searchParams.get('status') ?? 'all';
  const sortByParam = searchParams.get('sort') ?? 'created_at';
  const sortDirParam = searchParams.get('dir') ?? 'desc';

  const status =
    statusParam === 'all' ||
    statusParam === 'draft' ||
    statusParam === 'active' ||
    statusParam === 'paused' ||
    statusParam === 'ended' ||
    statusParam === 'archived'
      ? statusParam
      : 'all';

  const sortBy: ContestsFilters['sortBy'] =
    sortByParam === 'end_at' ||
    sortByParam === 'total_views' ||
    sortByParam === 'submission_count'
      ? sortByParam
      : 'created_at';

  const sortDir: ContestsFilters['sortDir'] =
    sortDirParam === 'asc' || sortDirParam === 'desc' ? sortDirParam : 'desc';

  return {
    search,
    status,
    sortBy,
    sortDir,
  };
}

export default async function BrandContestsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const { user } = await getSession();
  if (!user) {
    redirect('/auth/login');
  }

  const params = new URLSearchParams();
  Object.entries(searchParams ?? {}).forEach(([key, value]) => {
    if (typeof value === 'string') params.set(key, value);
  });

  const filters = parseFilters(params);
  const pageParam = params.get('page');
  const page = pageParam ? Math.max(1, Number.parseInt(pageParam, 10) || 1) : 1;
  const pageSize = 20;

  const { contests, total } = await getContestsList(user.id, filters, page, pageSize);
  const hasContestsAtAll = total > 0;

  return (
    <div className="brand-scope max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold text-[var(--text-1)]">
            Campaigns
          </h1>
          <p className="mt-0.5 text-[13px] text-[var(--text-3)]">
            Manage and monitor your contests
          </p>
        </div>
        <Link href="/app/brand/contests/new">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-[var(--r2)] px-5 py-2.5 bg-[var(--cta-bg)] text-[var(--cta-fg)] text-sm font-semibold hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-void)]"
          >
            New Contest
          </button>
        </Link>
      </div>

      <FiltersBar initialFilters={filters} totalCount={total} />

      {contests.length === 0 ? (
        <ContestsEmpty
          hasContestsAtAll={hasContestsAtAll}
        />
      ) : (
        <ContestsTable
          contests={contests}
          total={total}
          page={page}
          pageSize={pageSize}
          filters={filters}
        />
      )}
    </div>
  );
}

