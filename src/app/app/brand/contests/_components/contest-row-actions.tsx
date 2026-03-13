'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MoreHorizontal, Eye, Copy, Pause, Play, Rocket, XCircle, Settings } from 'lucide-react';
import { toast } from 'sonner';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import type { ContestListItem } from '../_types';
import { useCsrfToken } from '@/hooks/use-csrf-token';
import { ActionDialog } from '@/components/brand-ui';
import { cn } from '@/lib/utils';

interface ContestRowActionsProps {
  contest: ContestListItem;
  onActionComplete: () => void;
}

async function mutateContest(
  contestId: string,
  action: 'publish' | 'pause' | 'resume' | 'end' | 'duplicate',
  csrfToken: string,
) {
  const res = await fetch(`/api/brand/contests/${contestId}/${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf': csrfToken,
    },
    credentials: 'include',
  });

  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export function ContestRowActions({ contest, onActionComplete }: ContestRowActionsProps) {
  const router = useRouter();
  const csrfToken = useCsrfToken();
  const [loading, setLoading] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<'publish' | 'pause' | 'end' | null>(null);

  const handleMutation = useCallback(
    async (action: 'publish' | 'pause' | 'resume' | 'end' | 'duplicate') => {
      if (!csrfToken) {
        toast.error('Missing CSRF token. Please reload the page.');
        return;
      }
      setLoading(action);
      try {
        const result = await mutateContest(contest.id, action, csrfToken);
        if (!result.ok) {
          toast.error(result.data?.error || 'Something went wrong. Please try again.');
          return;
        }
        if (action === 'duplicate' && result.data?.contestId) {
          toast.success('Contest duplicated');
          router.push(`/app/brand/contests/${result.data.contestId}`);
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
                  : 'Action completed',
        );
        onActionComplete();
      } finally {
        setLoading(null);
        setConfirmAction(null);
      }
    },
    [contest.id, csrfToken, onActionComplete, router],
  );

  const showPublish = contest.status === 'draft';
  const showPause = contest.status === 'active';
  const showResume = contest.status === 'paused';
  const showEnd = contest.status === 'active' || contest.status === 'paused';

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex items-center justify-center rounded-[var(--r2)] p-1.5',
              'text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
            )}
            aria-label="Contest actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content
          className="z-50 min-w-[160px] rounded-[var(--r2)] border border-[var(--border-1)] bg-[var(--surface-2)] p-1 shadow-[var(--shadow-brand-2)]"
          sideOffset={4}
          align="end"
        >
          {/* View details */}
          <DropdownMenu.Item asChild>
            <Link
              href={`/app/brand/contests/${contest.id}`}
              className="flex cursor-pointer items-center gap-2 rounded-sm px-2.5 py-1.5 text-xs text-[var(--text-2)] outline-none transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text-1)] focus:bg-[var(--surface-3)] focus:text-[var(--text-1)]"
            >
              <Eye className="h-3.5 w-3.5" />
              View details
            </Link>
          </DropdownMenu.Item>

          {/* Edit settings */}
          <DropdownMenu.Item asChild>
            <Link
              href={`/app/brand/contests/${contest.id}/settings`}
              className="flex cursor-pointer items-center gap-2 rounded-sm px-2.5 py-1.5 text-xs text-[var(--text-2)] outline-none transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text-1)] focus:bg-[var(--surface-3)] focus:text-[var(--text-1)]"
            >
              <Settings className="h-3.5 w-3.5" />
              Edit settings
            </Link>
          </DropdownMenu.Item>

          {/* Duplicate */}
          <DropdownMenu.Item
            className="flex cursor-pointer items-center gap-2 rounded-sm px-2.5 py-1.5 text-xs text-[var(--text-2)] outline-none transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text-1)] focus:bg-[var(--surface-3)] focus:text-[var(--text-1)]"
            onSelect={(e) => {
              e.preventDefault();
              void handleMutation('duplicate');
            }}
            disabled={loading !== null}
          >
            <Copy className="h-3.5 w-3.5" />
            Duplicate
          </DropdownMenu.Item>

          {(showPublish || showPause || showResume || showEnd) && (
            <DropdownMenu.Separator className="my-1 h-px bg-[var(--border-1)]" />
          )}

          {/* Publish */}
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

          {/* Pause */}
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

          {/* Resume */}
          {showResume && (
            <DropdownMenu.Item
              className="flex cursor-pointer items-center gap-2 rounded-sm px-2.5 py-1.5 text-xs text-[var(--text-2)] outline-none transition-colors hover:bg-[var(--surface-3)] focus:bg-[var(--surface-3)]"
              onSelect={(e) => {
                e.preventDefault();
                void handleMutation('resume');
              }}
              disabled={loading !== null}
            >
              <Play className="h-3.5 w-3.5" />
              Resume
            </DropdownMenu.Item>
          )}

          {/* End (danger) */}
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

      {/* Confirm dialogs */}
      <ActionDialog
        open={confirmAction === 'publish'}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title="Publish contest?"
        description="This will make your contest visible to creators."
        confirmLabel="Publish"
        onConfirm={() => void handleMutation('publish')}
        loading={loading === 'publish'}
      />

      <ActionDialog
        open={confirmAction === 'pause'}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title="Pause contest?"
        description="Creators won't be able to submit while paused."
        confirmLabel="Pause"
        onConfirm={() => void handleMutation('pause')}
        loading={loading === 'pause'}
      />

      <ActionDialog
        open={confirmAction === 'end'}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title="End contest?"
        description="This cannot be undone. No more submissions will be accepted."
        confirmLabel="End contest"
        onConfirm={() => void handleMutation('end')}
        loading={loading === 'end'}
        intent="danger"
      />
    </>
  );
}

