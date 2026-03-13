'use client';

import { useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

type SubmissionStatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

interface SubmissionFiltersProps {
  contestId: string;
  initialStatus: SubmissionStatusFilter;
}

const STATUS_PILLS: { value: SubmissionStatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

export function SubmissionFilters({ initialStatus }: SubmissionFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateStatus = useCallback(
    (status: SubmissionStatusFilter) => {
      const params = new URLSearchParams(searchParams.toString());
      if (status === 'all') {
        params.delete('status');
      } else {
        params.set('status', status);
      }
      params.delete('page');
      const query = params.toString();
      router.replace(`${window.location.pathname}${query ? `?${query}` : ''}`);
    },
    [router, searchParams],
  );

  return (
    <div
      role="tablist"
      aria-label="Filter submissions by status"
      className="inline-flex items-center gap-1 rounded-[var(--r2)] bg-[var(--surface-1)] p-1"
    >
      {STATUS_PILLS.map((pill) => {
        const active = initialStatus === pill.value;
        return (
          <button
            key={pill.value}
            type="button"
            role="tab"
            onClick={() => updateStatus(pill.value)}
            className={cn(
              'px-3 py-1 text-[11px] font-medium rounded-full border transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
              active
                ? 'bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent-edge)]'
                : 'bg-[var(--surface-2)] text-[var(--text-3)] border-transparent hover:text-[var(--text-2)] hover:border-[var(--border-1)]',
            )}
          >
            {pill.label}
          </button>
        );
      })}
    </div>
  );
}

