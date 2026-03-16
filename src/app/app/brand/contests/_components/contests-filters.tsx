'use client';

import { useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Check, ChevronDown } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { BrandInput } from '@/components/brand-ui';
import type { ContestsFilters } from '../_types';
import { cn } from '@/lib/utils';

interface ContestsFiltersProps {
  initialFilters: ContestsFilters;
  totalCount: number;
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'draft', label: 'Draft' },
  { value: 'paused', label: 'Paused' },
  { value: 'ended', label: 'Ended' },
  { value: 'archived', label: 'Archived' },
] as const;

const SORT_OPTIONS: {
  value: string;
  label: string;
  sortBy: ContestsFilters['sortBy'];
  sortDir: ContestsFilters['sortDir'];
}[] = [
  { value: 'created_at_desc', label: 'Newest first', sortBy: 'created_at', sortDir: 'desc' },
  { value: 'created_at_asc', label: 'Oldest first', sortBy: 'created_at', sortDir: 'asc' },
  { value: 'end_at_asc', label: 'Ending soon', sortBy: 'end_at', sortDir: 'asc' },
  { value: 'views_desc', label: 'Most views', sortBy: 'total_views', sortDir: 'desc' },
];

export function ContestsFilters({ initialFilters, totalCount }: ContestsFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const timeoutRef = useRef<number | undefined>(undefined);

  const updateUrl = useCallback(
    (next: Partial<ContestsFilters>) => {
      const params = new URLSearchParams(searchParams.toString());

      if (next.search !== undefined) {
        if (next.search) params.set('search', next.search);
        else params.delete('search');
      }
      if (next.status !== undefined) {
        if (next.status && next.status !== 'all') params.set('status', next.status);
        else params.delete('status');
      }
      if (next.sortBy !== undefined) {
        params.set('sort', next.sortBy);
      }
      if (next.sortDir !== undefined) {
        params.set('dir', next.sortDir);
      }

      params.delete('page'); // reset pagination on any filter change

      const query = params.toString();
      router.replace(`/app/brand/contests${query ? `?${query}` : ''}`);
    },
    [router, searchParams],
  );

  const handleSearchChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => {
        updateUrl({ search: value });
      }, 300);
    },
    [updateUrl],
  );

  const currentSort = SORT_OPTIONS.find(
    (opt) =>
      opt.sortBy === initialFilters.sortBy &&
      opt.sortDir === initialFilters.sortDir,
  ) ?? SORT_OPTIONS[0];

  const hasActiveFilters =
    initialFilters.search !== '' || initialFilters.status !== 'all';

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {/* Search */}
      <div className="relative w-full max-w-xs">
        <BrandInput
          startIcon={Search}
          placeholder="Search campaigns..."
          defaultValue={initialFilters.search}
          onChange={handleSearchChange}
          aria-label="Search campaigns"
        />
      </div>

      {/* Right side: pills + sort + reset */}
      <div className="flex flex-1 items-center justify-end gap-3 flex-wrap">
        {/* Status pills */}
        <div
          role="tablist"
          aria-label="Filter by status"
          className="flex items-center gap-1 rounded-[var(--r2)] bg-[var(--surface-1)] p-1"
        >
          {STATUS_OPTIONS.map((option) => {
            const active = initialFilters.status === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={active ? 'true' : 'false'}
                onClick={() =>
                  updateUrl({
                    status: option.value as ContestsFilters['status'],
                  })
                }
                className={cn(
                  'px-3 py-1 text-[11px] font-medium rounded-full border transition-colors duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
                  active
                    ? 'bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent-edge)]'
                    : 'bg-[var(--surface-2)] text-[var(--text-3)] border-transparent hover:text-[var(--text-2)] hover:border-[var(--border-1)]',
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {/* Sort dropdown — Radix DropdownMenu */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-[var(--r2)] border border-[var(--border-1)] bg-[var(--surface-2)] px-3 py-1.5 text-[13px] text-[var(--text-2)] transition-colors duration-150 hover:border-[var(--border-2)] hover:text-[var(--text-1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              aria-label="Sort campaigns"
            >
              <span>{currentSort.label}</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content
            align="end"
            sideOffset={4}
            className="z-50 min-w-[160px] rounded-[var(--r3)] border border-[var(--border-1)] bg-[var(--surface-1)] p-1 shadow-[var(--shadow-2)]"
          >
            {SORT_OPTIONS.map((opt) => {
              const active = opt.value === currentSort.value;
              return (
                <DropdownMenu.Item
                  key={opt.value}
                  onSelect={() => {
                    updateUrl({
                      sortBy: opt.sortBy,
                      sortDir: opt.sortDir,
                    });
                  }}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-[var(--r2)] px-3 py-2 text-[13px] text-[var(--text-2)] outline-none hover:bg-[var(--surface-2)] hover:text-[var(--text-1)] data-[highlighted]:bg-[var(--surface-2)] data-[highlighted]:text-[var(--text-1)]',
                    active && 'font-medium text-[var(--accent)]',
                  )}
                >
                  {active && <Check className="h-3.5 w-3.5" />}
                  {!active && <span className="h-3.5 w-3.5" aria-hidden="true" />}
                  <span>{opt.label}</span>
                </DropdownMenu.Item>
              );
            })}
          </DropdownMenu.Content>
        </DropdownMenu.Root>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={() =>
              updateUrl({
                search: '',
                status: 'all',
                sortBy: 'created_at',
                sortDir: 'desc',
              })
            }
            className="text-[12px] text-[var(--accent)] underline-offset-2 hover:underline"
          >
            Clear filters
          </button>
        )}

        {/* Count */}
        <span className="text-[13px] text-[var(--text-3)]">
          {totalCount} campaign{totalCount === 1 ? '' : 's'}
        </span>
      </div>
    </div>
  );
}

