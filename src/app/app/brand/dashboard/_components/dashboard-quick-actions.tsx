import Link from 'next/link';
import { Plus, CheckSquare, MessageSquare } from 'lucide-react';
import { Panel, Card, StatusBadge, type StatusKey } from '@/components/brand-ui';
import type { RecentContest } from '../_types';

interface DashboardQuickActionsProps {
  contests: RecentContest[];
}

export function DashboardQuickActions({ contests }: DashboardQuickActionsProps) {
  const recent = contests.slice(0, 3);

  return (
    <Panel
      title="Quick actions"
      className="h-full"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3">
          <Link href="/app/brand/contests/new">
            <Card variant="hoverable" className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-[var(--r2)] bg-[var(--accent-soft)] text-[var(--brand-accent)]">
                <Plus className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--text-1)]">
                  Create contest
                </p>
                <p className="text-xs text-[var(--text-3)]">
                  Launch a new UGC campaign in minutes.
                </p>
              </div>
            </Card>
          </Link>

          <Link href="/app/brand/contests?filter=pending">
            <Card variant="hoverable" className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-[var(--r2)] bg-[var(--surface-2)] text-[var(--text-2)]">
                <CheckSquare className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--text-1)]">
                  Review submissions
                </p>
                <p className="text-xs text-[var(--text-3)]">
                  Moderate pending videos across campaigns.
                </p>
              </div>
            </Card>
          </Link>

          <Link href="/app/brand/messages">
            <Card variant="hoverable" className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-[var(--r2)] bg-[var(--surface-2)] text-[var(--text-2)]">
                <MessageSquare className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--text-1)]">
                  Messages
                </p>
                <p className="text-xs text-[var(--text-3)]">
                  Follow up with creators in your inbox.
                </p>
              </div>
            </Card>
          </Link>
        </div>

        <div className="pt-2 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">
              Recent
            </p>
            <Link
              href="/app/brand/contests"
              className="text-xs font-medium text-[var(--text-3)] hover:text-[var(--text-2)]"
            >
              View all →
            </Link>
          </div>

          {recent.length === 0 ? (
            <p className="text-xs text-[var(--text-3)]">
              No campaigns yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {recent.map((contest) => (
                <li key={contest.id}>
                  <Link
                    href={`/app/brand/contests/${contest.id}`}
                    className="flex items-center justify-between gap-3 rounded-[var(--r2)] px-2 py-1.5 hover:bg-[var(--surface-2)]/40 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-[var(--text-1)] truncate">
                        {contest.title}
                      </p>
                      <p className="text-[11px] text-[var(--text-3)]">
                        {contest.submissionCount} submissions
                      </p>
                    </div>
                    <StatusBadge status={contest.status as StatusKey} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Panel>
  );
}

