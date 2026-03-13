import { EmptyState, Panel } from '@/components/brand-ui';
import type { ContestDetail, SubmissionItem } from '../../_types';
import { SubmissionFilters } from '../ugc/submission-filters';
import { SubmissionCard } from '../ugc/submission-card';

interface TabUgcProps {
  contest: ContestDetail;
  submissions: SubmissionItem[];
  total: number;
  page: number;
  pageSize: number;
  status: 'all' | 'pending' | 'approved' | 'rejected';
}

export function TabUgc({
  contest,
  submissions,
  total,
  page,
  pageSize,
  status,
}: TabUgcProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/contests/${contest.id}`);
    } catch {
      // Silently ignore; UX will still show the empty state.
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-[var(--text-1)]">
            UGC — {total} submission{total === 1 ? '' : 's'}
          </h2>
          <p className="mt-0.5 text-[13px] text-[var(--text-3)]">
            Review and manage creator submissions for this campaign.
          </p>
        </div>
        <SubmissionFilters contestId={contest.id} initialStatus={status} />
      </div>

      {total === 0 ? (
        <Panel>
          <EmptyState
            title="No submissions yet"
            description="Share your contest link to start receiving creator submissions."
            action={{
              label: 'Copy contest link',
              onClick: handleCopyLink,
            }}
          />
        </Panel>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {submissions.map((submission) => (
              <SubmissionCard
                key={submission.id}
                submission={submission}
                contestId={contest.id}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2 text-[13px] text-[var(--text-3)]">
              <span>
                Showing {from}–{to} of {total} submissions
              </span>
              <span>
                Page {page} of {totalPages}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

