'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { MoreHorizontal, Copy, Eye, Pause, Play, Rocket, XCircle } from 'lucide-react';
import { StatusBadge, ActionDialog } from '@/components/brand-ui';
import { useCsrfToken } from '@/hooks/use-csrf-token';
import { toast } from 'sonner';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { cn } from '@/lib/utils';
import type { ContestDetail, ContestStatus } from '../_types';

interface ContestHeaderProps {
  contest: ContestDetail;
}

export function ContestHeader({ contest }: ContestHeaderProps) {
  const endDate = new Date(contest.endAt);
  const now = new Date();
  const isPast = endDate.getTime() < now.getTime();

  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-[22px] font-semibold text-[var(--text-1)]">
            {contest.title}
          </h1>
          <StatusBadge status={contest.status} />
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]">
          <div className="flex flex-wrap gap-1.5">
            {contest.networks.map((network) => (
              <span
                key={network}
                className="rounded-[999px] bg-[var(--surface-3)] px-2 py-1 text-[10px] text-[var(--text-2)]"
              >
                {network}
              </span>
            ))}
            {contest.networks.length === 0 && (
              <span className="text-[var(--text-3)]">No networks selected</span>
            )}
          </div>
          <span className="h-1 w-1 rounded-full bg-[var(--border-2)]" aria-hidden="true" />
          <span>
            {isPast ? 'Ended ' : 'Ends '}
            {formatDistanceToNow(endDate, { addSuffix: true, locale: enUS })}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Link
          href={`/contests/${contest.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-[var(--r2)] border border-[var(--border-1)] px-3 py-2 text-xs font-medium text-[var(--text-2)] transition-colors hover:border-[var(--border-2)] hover:text-[var(--text-1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          View public page
        </Link>

        <ContestDetailActions
          contestId={contest.id}
          status={contest.status}
          title={contest.title}
        />
      </div>
    </header>
  );
}

type ContestAction = 'publish' | 'pause' | 'resume' | 'end' | 'duplicate';

interface ContestDetailActionsProps {
  contestId: string;
  status: ContestStatus;
  title: string;
}

function ContestDetailActions({ contestId, status }: ContestDetailActionsProps) {
  const csrfToken = useCsrfToken();
  const [loading, setLoading] = useState<ContestAction | null>(null);
  const [confirmAction, setConfirmAction] = useState<'publish' | 'pause' | 'end' | null>(null);

  const showPublish = status === 'draft';
  const showPause = status === 'active';
  const showResume = status === 'paused';
  const showEnd = status === 'active' || status === 'paused';

  const mutateContest = useCallback(
    async (action: ContestAction) => {
      if (!csrfToken) {
        toast.error('Missing CSRF token. Please reload the page.');
        return;
      }
      setLoading(action);
      try {
        const res = await fetch(`/api/brand/contests/${contestId}/${action}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf': csrfToken,
          },
          credentials: 'include',
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(data?.error || 'Something went wrong. Please try again.');
          return;
        }
        toast.success(
          action === 'publish'
            ? 'Contest published'
            : action === 'pause'
              ? 'Contest paused'
              : action === 'resume'
                ? 'Contest resumed'
                : action === 'end'
                  ? 'Contest ended'
                  : 'Contest duplicated',
        );
        if (action === 'duplicate' && data?.contestId) {
          window.location.assign(`/app/brand/contests/${data.contestId}`);
        } else {
          window.location.reload();
        }
      } finally {
        setLoading(null);
        setConfirmAction(null);
      }
    },
    [contestId, csrfToken],
  );

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex h-9 w-9 items-center justify-center rounded-[var(--r2)] border border-[var(--border-1)] text-[var(--text-2)]',
              'hover:border-[var(--border-2)] hover:text-[var(--text-1)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
            )}
            aria-label="Campaign actions"
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content
          className="z-50 min-w-[160px] rounded-[var(--r2)] border border-[var(--border-1)] bg-[var(--surface-2)] p-1 shadow-[var(--shadow-brand-2)]"
          sideOffset={4}
          align="end"
        >
          <DropdownMenu.Item
            className="flex cursor-pointer items-center gap-2 rounded-sm px-2.5 py-1.5 text-xs text-[var(--text-2)] outline-none transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text-1)] focus:bg-[var(--surface-3)] focus:text-[var(--text-1)]"
            onSelect={(e) => {
              e.preventDefault();
              window.location.assign(`/app/brand/contests/${contestId}`);
            }}
          >
            <Eye className="h-3.5 w-3.5" />
            View details
          </DropdownMenu.Item>

          <DropdownMenu.Item
            className="flex cursor-pointer items-center gap-2 rounded-sm px-2.5 py-1.5 text-xs text-[var(--text-2)] outline-none transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text-1)] focus:bg-[var(--surface-3)] focus:text-[var(--text-1)]"
            onSelect={(e) => {
              e.preventDefault();
              window.location.assign(`/app/brand/contests/${contestId}/settings`);
            }}
          >
            <Copy className="h-3.5 w-3.5" />
            Edit settings
          </DropdownMenu.Item>

          <DropdownMenu.Item
            className="flex cursor-pointer items-center gap-2 rounded-sm px-2.5 py-1.5 text-xs text-[var(--text-2)] outline-none transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text-1)] focus:bg-[var(--surface-3)] focus:text-[var(--text-1)]"
            onSelect={(e) => {
              e.preventDefault();
              void mutateContest('duplicate');
            }}
            disabled={loading !== null}
          >
            <Copy className="h-3.5 w-3.5" />
            Duplicate
          </DropdownMenu.Item>

          {(showPublish || showPause || showResume || showEnd) && (
            <DropdownMenu.Separator className="my-1 h-px bg-[var(--border-1)]" />
          )}

          {showPublish && (
            <DropdownMenu.Item
              className="flex cursor-pointer items-center gap-2 rounded-sm px-2.5 py-1.5 text-xs text-[var(--accent)] outline-none transition-colors hover:bg-[var(--accent-soft)]/40 focus:bg-[var(--accent-soft)]/40"
              onSelect={(e) => {
                e.preventDefault();
                setConfirmAction('publish');
              }}
              disabled={loading !== null}
            >
              <Rocket className="h-3.5 w-3.5" />
              Publish
            </DropdownMenu.Item>
          )}

          {showPause && (
            <DropdownMenu.Item
              className="flex cursor-pointer items-center gap-2 rounded-sm px-2.5 py-1.5 text-xs text-[var(--text-2)] outline-none transition-colors hover:bg-[var(--surface-3)] focus:bg-[var(--surface-3)]"
              onSelect={(e) => {
                e.preventDefault();
                setConfirmAction('pause');
              }}
              disabled={loading !== null}
            >
              <Pause className="h-3.5 w-3.5" />
              Pause
            </DropdownMenu.Item>
          )}

          {showResume && (
            <DropdownMenu.Item
              className="flex cursor-pointer items-center gap-2 rounded-sm px-2.5 py-1.5 text-xs text-[var(--text-2)] outline-none transition-colors hover:bg-[var(--surface-3)] focus:bg-[var(--surface-3)]"
              onSelect={(e) => {
                e.preventDefault();
                void mutateContest('resume');
              }}
              disabled={loading !== null}
            >
              <Play className="h-3.5 w-3.5" />
              Resume
            </DropdownMenu.Item>
          )}

          {showEnd && (
            <>
              <DropdownMenu.Separator className="my-1 h-px bg-[var(--border-1)]" />
              <DropdownMenu.Item
                className="flex cursor-pointer items-center gap-2 rounded-sm px-2.5 py-1.5 text-xs text-[var(--danger)] outline-none transition-colors hover:bg-[var(--danger)]/10 focus:bg-[var(--danger)]/10"
                onSelect={(e) => {
                  e.preventDefault();
                  setConfirmAction('end');
                }}
                disabled={loading !== null}
              >
                <XCircle className="h-3.5 w-3.5" />
                End contest
              </DropdownMenu.Item>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Root>

      <ActionDialog
        open={confirmAction === 'publish'}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title="Publish contest?"
        description="This will make your contest visible to creators."
        confirmLabel="Publish"
        onConfirm={() => void mutateContest('publish')}
        loading={loading === 'publish'}
      />
      <ActionDialog
        open={confirmAction === 'pause'}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title="Pause contest?"
        description="Creators won't be able to submit while paused."
        confirmLabel="Pause"
        onConfirm={() => void mutateContest('pause')}
        loading={loading === 'pause'}
      />
      <ActionDialog
        open={confirmAction === 'end'}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title="End contest?"
        description="This cannot be undone. No more submissions will be accepted."
        confirmLabel="End contest"
        onConfirm={() => void mutateContest('end')}
        loading={loading === 'end'}
        intent="danger"
      />
    </>
  );
}


