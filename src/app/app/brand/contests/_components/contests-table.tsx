'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { differenceInDays, formatDistanceToNow } from 'date-fns';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable, StatusBadge, type StatusKey } from '@/components/brand-ui';
import type { ContestListItem, ContestsFilters } from '../_types';
import { cn } from '@/lib/utils';
import { ContestRowActions } from './contest-row-actions';
import { ContestDrawer } from './contest-drawer';

interface ContestsTableProps {
  contests: ContestListItem[];
  total: number;
  page: number;
  pageSize: number;
  filters: ContestsFilters;
}

function formatCurrencyCompact(amountCents: number, currency: string) {
  const amount = amountCents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'EUR',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount);
}

function formatCompactNumber(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString('en-US');
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  // Safe window check
  if (typeof window !== 'undefined') {
    // Simple heuristic, avoids hooks complexity
    const width = window.innerWidth || 0;
    if (isMobile !== (width < 768)) {
      setIsMobile(width < 768);
    }
  }

  return isMobile;
}

export function ContestsTable({
  contests,
  total,
  page,
  pageSize,
  filters,
}: ContestsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();
  const [selectedContest, setSelectedContest] = useState<ContestListItem | null>(null);

  const columns: ColumnDef<ContestListItem>[] = useMemo(
    () => [
      {
        header: 'Campaign',
        accessorKey: 'title',
        cell: ({ row }) => {
          const c = row.original;
          return (
            <div className="flex flex-col">
              <Link
                href={`/app/brand/contests/${c.id}`}
                className="text-[14px] font-medium text-[var(--text-1)] hover:text-[var(--accent)] transition-colors"
              >
                {c.title}
              </Link>
              <div className="mt-0.5 flex flex-wrap gap-1">
                {c.networks.map((net) => (
                  <span
                    key={net}
                    className="rounded-full bg-[var(--surface-3)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--text-3)]"
                  >
                    {net}
                  </span>
                ))}
              </div>
            </div>
          );
        },
      },
      {
        header: 'Status',
        accessorKey: 'status',
        cell: ({ row }) => (
          <StatusBadge status={row.original.status as StatusKey} />
        ),
      },
      {
        header: 'Budget',
        accessorKey: 'budgetCents',
        meta: { numeric: true },
        cell: ({ row }) => (
          <span className="tabular-nums text-[var(--text-1)]">
            {formatCurrencyCompact(row.original.budgetCents, row.original.currency)}
          </span>
        ),
      },
      {
        header: 'Subs',
        accessorKey: 'submissionCount',
        meta: { numeric: true },
        cell: ({ row }) => {
          const { approvedCount, submissionCount } = row.original;
          const hasApproved = approvedCount > 0;
          return (
            <span
              className={cn(
                'tabular-nums text-[13px]',
                hasApproved ? 'text-[var(--accent)]' : 'text-[var(--text-3)]',
              )}
            >
              {approvedCount}/{submissionCount}
            </span>
          );
        },
      },
      {
        header: 'Views',
        accessorKey: 'totalViews',
        meta: { numeric: true },
        cell: ({ row }) => (
          <span className="tabular-nums text-[var(--text-1)]">
            {formatCompactNumber(row.original.totalViews)}
          </span>
        ),
      },
      {
        header: 'Ends',
        accessorKey: 'endAt',
        cell: ({ row }) => {
          const c = row.original;
          if (c.status === 'draft') {
            return (
              <span className="text-[12px] text-[var(--text-3)]">
                —
              </span>
            );
          }

          const daysLeft = differenceInDays(new Date(c.endAt), new Date());

          if (daysLeft < 0) {
            return (
              <span className="text-[12px] text-[var(--text-3)]">
                {formatDistanceToNow(new Date(c.endAt), { addSuffix: true })}
              </span>
            );
          }

          if (daysLeft <= 3) {
            return (
              <span className="text-[12px] font-medium text-[var(--warning)]">
                In {daysLeft}d
              </span>
            );
          }

          return (
            <span className="text-[12px] text-[var(--text-2)]">
              In {daysLeft}d
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <ContestRowActions
            contest={row.original}
            onActionComplete={() => router.refresh()}
          />
        ),
      },
    ],
    [router],
  );

  const handleRowClick = (contest: ContestListItem) => {
    if (!isMobile) return;
    setSelectedContest(contest);
  };

  const totalPages = Math.ceil(total / pageSize);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const goToPage = (nextPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextPage <= 1) params.delete('page');
    else params.set('page', String(nextPage));
    const query = params.toString();
    router.replace(`/app/brand/contests${query ? `?${query}` : ''}`);
  };

  return (
    <div className="space-y-4">
      <DataTable
        columns={columns}
        data={contests}
        pagination={false}
        onRowClick={handleRowClick}
      />

      {totalPages > 1 && (
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[13px] text-[var(--text-3)]">
            Showing {from}–{to} of {total} campaigns
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              className={cn(
                'h-8 px-3 rounded-[var(--r2)] border border-[var(--border-1)] bg-[var(--surface-2)] text-[13px] text-[var(--text-2)]',
                'hover:text-[var(--text-1)] disabled:opacity-40 disabled:cursor-not-allowed',
              )}
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
              className={cn(
                'h-8 px-3 rounded-[var(--r2)] border border-[var(--border-1)] bg-[var(--surface-2)] text-[13px] text-[var(--text-2)]',
                'hover:text-[var(--text-1)] disabled:opacity-40 disabled:cursor-not-allowed',
              )}
            >
              Next
            </button>
          </div>
        </div>
      )}

      <ContestDrawer
        contest={selectedContest}
        open={!!selectedContest}
        onClose={() => setSelectedContest(null)}
      />
    </div>
  );
}

