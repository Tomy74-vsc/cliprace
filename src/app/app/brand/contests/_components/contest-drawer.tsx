'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { BrandDrawer, StatusBadge, type StatusKey } from '@/components/brand-ui';
import type { ContestListItem } from '../_types';

interface ContestDrawerProps {
  contest: ContestListItem | null;
  open: boolean;
  onClose: () => void;
}

function useIsMobile() {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768;
}

function formatCurrency(amountCents: number, currency: string) {
  const amount = amountCents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'EUR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCompactNumber(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString('en-US');
}

export function ContestDrawer({ contest, open, onClose }: ContestDrawerProps) {
  const isMobile = useIsMobile();
  if (!isMobile || !contest) return null;

  const endLabel =
    contest.status === 'draft'
      ? null
      : `Ends ${formatDistanceToNow(new Date(contest.endAt), {
          addSuffix: true,
        })}`;

  return (
    <BrandDrawer
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={contest.title}
      description={endLabel ?? undefined}
    >
      <div className="space-y-5">
        <StatusBadge status={contest.status as StatusKey} />

        {/* KPI strip */}
        <div className="grid grid-cols-3 gap-3 mt-3">
          <div>
            <p className="text-[11px] text-[var(--text-3)] uppercase tracking-wide">
              Budget
            </p>
            <p className="mt-1 text-[18px] font-semibold tabular-nums text-[var(--text-1)]">
              {formatCurrency(contest.budgetCents, contest.currency)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-[var(--text-3)] uppercase tracking-wide">
              Subs
            </p>
            <p className="mt-1 text-[18px] font-semibold tabular-nums text-[var(--text-1)]">
              {contest.approvedCount}/{contest.submissionCount}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-[var(--text-3)] uppercase tracking-wide">
              Views
            </p>
            <p className="mt-1 text-[18px] font-semibold tabular-nums text-[var(--text-1)]">
              {formatCompactNumber(contest.totalViews)}
            </p>
          </div>
        </div>

        {/* Networks */}
        {contest.networks.length > 0 && (
          <div className="mt-2">
            <p className="text-[11px] text-[var(--text-3)] uppercase tracking-wide mb-1">
              Networks
            </p>
            <div className="flex flex-wrap gap-1.5">
              {contest.networks.map((net) => (
                <span
                  key={net}
                  className="rounded-full bg-[var(--surface-3)] px-2 py-0.5 text-[11px] uppercase tracking-wide text-[var(--text-3)]"
                >
                  {net}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 space-y-2">
          <Link
            href={`/app/brand/contests/${contest.id}`}
            className="flex w-full items-center justify-center gap-2 rounded-[var(--r2)] bg-[var(--cta-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--cta-fg)] hover:bg-white/90"
          >
            View campaign
          </Link>

          <Link
            href={`/app/brand/contests/${contest.id}/duplicate`}
            className="flex w-full items-center justify-center gap-2 rounded-[var(--r2)] border border-[var(--border-1)] px-4 py-2.5 text-sm font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)]"
          >
            Duplicate
          </Link>
        </div>
      </div>
    </BrandDrawer>
  );
}

