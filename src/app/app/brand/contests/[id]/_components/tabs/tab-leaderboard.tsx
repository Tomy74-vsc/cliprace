import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { DownloadCloud } from 'lucide-react';
import { Panel, DataTable, EmptyState } from '@/components/brand-ui';
import type { LeaderboardEntry, ContestDetail } from '../../_types';

interface TabLeaderboardProps {
  contest: ContestDetail;
  leaderboard: LeaderboardEntry[];
}

export function TabLeaderboard({ contest, leaderboard }: TabLeaderboardProps) {
  const columns = useMemo<ColumnDef<LeaderboardEntry>[]>(
    () => [
      {
        header: '#',
        accessorKey: 'rank',
        meta: { numeric: true },
        cell: ({ row }) => (
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--surface-2)] text-[11px] font-semibold text-[var(--text-1)]">
            {row.original.rank}
          </span>
        ),
      },
      {
        header: 'Creator',
        accessorKey: 'creatorName',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-2)] text-[11px] font-semibold text-[var(--text-1)]">
              {row.original.creatorName
                .split(' ')
                .map((part) => part[0])
                .join('')
                .slice(0, 2)}
            </div>
            <div className="flex flex-col">
              <span className="text-[13px] font-medium text-[var(--text-1)]">
                {row.original.creatorName}
              </span>
            </div>
          </div>
        ),
      },
      {
        header: 'Weighted views',
        accessorKey: 'totalWeightedViews',
        meta: { numeric: true },
        cell: ({ row }) => (
          <span className="tabular-nums text-[var(--text-1)]">
            {row.original.totalWeightedViews.toLocaleString('en-US')}
          </span>
        ),
      },
      {
        header: 'Views',
        accessorKey: 'totalViews',
        meta: { numeric: true },
        cell: ({ row }) => (
          <span className="tabular-nums text-[var(--text-2)]">
            {row.original.totalViews.toLocaleString('en-US')}
          </span>
        ),
      },
      {
        header: 'Likes',
        accessorKey: 'totalLikes',
        meta: { numeric: true },
        cell: ({ row }) => (
          <span className="tabular-nums text-[var(--text-2)]">
            {row.original.totalLikes.toLocaleString('en-US')}
          </span>
        ),
      },
      {
        header: 'Subs',
        accessorKey: 'submissionCount',
        meta: { numeric: true },
        cell: ({ row }) => (
          <span className="tabular-nums text-[var(--text-2)]">
            {row.original.submissionCount}
          </span>
        ),
      },
      {
        header: 'Est. prize',
        accessorKey: 'estimatedPrizeCents',
        meta: { numeric: true },
        cell: ({ row }) => (
          <span className="tabular-nums text-[var(--text-1)]">
            {formatCurrency(row.original.estimatedPrizeCents, contest.currency)}
          </span>
        ),
      },
    ],
    [contest.currency],
  );

  const handleExportCsv = () => {
    if (!leaderboard.length) return;
    const header = [
      'Rank',
      'Creator',
      'WeightedViews',
      'Views',
      'Likes',
      'Submissions',
      'EstimatedPrizeCents',
    ].join(',');

    const lines = leaderboard.map((row) =>
      [
        row.rank,
        JSON.stringify(row.creatorName),
        row.totalWeightedViews,
        row.totalViews,
        row.totalLikes,
        row.submissionCount,
        row.estimatedPrizeCents,
      ].join(','),
    );

    const csv = `${header}\n${lines.join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `cliprace-leaderboard-${contest.id}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Panel
      title="Leaderboard"
      description="Top creators ranked by weighted views."
      action={
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={!leaderboard.length}
          className="inline-flex items-center gap-1 rounded-[var(--r2)] border border-[var(--border-1)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-2)] hover:border-[var(--border-2)] hover:text-[var(--text-1)] disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          <DownloadCloud className="h-3.5 w-3.5" aria-hidden="true" />
          Export CSV
        </button>
      }
    >
      {leaderboard.length === 0 ? (
        <EmptyState
          title="No rankings yet"
          description="Rankings appear once submissions receive views."
        />
      ) : (
        <DataTable
          columns={columns}
          data={leaderboard}
          pagination={false}
        />
      )}
    </Panel>
  );
}

function formatCurrency(amountCents: number, currency: string) {
  const amount = amountCents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'EUR',
    maximumFractionDigits: 2,
  }).format(amount);
}

