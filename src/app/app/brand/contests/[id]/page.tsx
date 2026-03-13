import { notFound, redirect } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { ContestHeader } from './_components/contest-header';
import { ContestTabs } from './_components/contest-tabs';
import {
  getContestDetail,
  getContestLeaderboard,
  getContestMetrics,
  getContestSubmissions,
} from './_data';
import type { ContestDetail, ContestMetrics } from './_types';

const DEFAULT_PAGE_SIZE = 20;

type ContestTab = 'overview' | 'ugc' | 'leaderboard' | 'analytics' | 'settings';

type SubmissionStatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

function parseTab(value: string | string[] | undefined): ContestTab {
  const raw = Array.isArray(value) ? value[0] : value;
  switch (raw) {
    case 'ugc':
    case 'leaderboard':
    case 'analytics':
    case 'settings':
      return raw;
    default:
      return 'overview';
  }
}

function parseStatusFilter(value: string | string[] | undefined): SubmissionStatusFilter {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === 'pending' || raw === 'approved' || raw === 'rejected') return raw;
  return 'all';
}

function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return 1;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) || parsed < 1 ? 1 : parsed;
}

export default async function BrandContestDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const { user } = await getSession();
  if (!user) {
    redirect('/auth/login');
  }

  const contestId = params.id;
  const activeTab = parseTab(searchParams?.tab);

  const submissionsPage = parsePage(searchParams?.page);
  const submissionsStatus = parseStatusFilter(searchParams?.status);

  const [contest, metrics] = await Promise.all([
    getContestDetail(contestId, user.id),
    activeTab === 'overview' || activeTab === 'analytics'
      ? (async () => {
          const base = await getContestDetail(contestId, user.id);
          if (!base) return null;
          return getContestMetrics(contestId, base.prizePoolCents);
        })()
      : Promise.resolve<ContestMetrics | null>(null),
  ]);

  if (!contest) {
    notFound();
  }

  const [submissions, leaderboard] = await Promise.all([
    activeTab === 'ugc'
      ? getContestSubmissions(contestId, submissionsStatus, submissionsPage, DEFAULT_PAGE_SIZE)
      : Promise.resolve<{ submissions: never[]; total: number }>({ submissions: [], total: 0 }),
    activeTab === 'leaderboard'
      ? getContestLeaderboard(contestId, contest.prizePoolCents, 30)
      : Promise.resolve([]),
  ]);

  return (
    <div className="brand-scope max-w-7xl mx-auto px-6 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/app/brand/contests"
          className="inline-flex items-center gap-1 text-[13px] text-[var(--text-3)] hover:text-[var(--text-1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-[var(--r2)] px-1 py-0.5 -ml-1"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Campaigns
        </Link>
      </div>

      <ContestHeader contest={contest as ContestDetail} />

      <ContestTabs
        contestId={contest.id}
        activeTab={activeTab}
        contest={contest}
        metrics={metrics}
        submissions={activeTab === 'ugc' ? submissions : null}
        leaderboard={activeTab === 'leaderboard' ? leaderboard : null}
        submissionsPagination={{
          page: submissionsPage,
          pageSize: DEFAULT_PAGE_SIZE,
        }}
      />
    </div>
  );
}

