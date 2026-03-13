'use client';

import Image from 'next/image';
import { Video, Eye, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatusBadge, Card } from '@/components/brand-ui';
import type { SubmissionItem } from '../../_types';
import { SubmissionActions } from './submission-actions';

interface SubmissionCardProps {
  submission: SubmissionItem;
  contestId: string;
}

function formatCompactNumber(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString('en-US');
}

export function SubmissionCard({ submission, contestId }: SubmissionCardProps) {
  const isPending = submission.status === 'pending';

  return (
    <Card className="overflow-hidden border-[var(--border-1)] bg-[var(--surface-1)]/80 hover:border-[var(--border-2)] transition-colors">
      {/* Thumbnail */}
      <div className="relative aspect-video w-full overflow-hidden">
        {submission.thumbnailUrl ? (
          <Image
            src={submission.thumbnailUrl}
            alt=""
            fill
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[var(--surface-2)]">
            <Video className="h-8 w-8 text-[var(--text-3)]" aria-hidden="true" />
          </div>
        )}
        {submission.videoUrl && (
          <a
            href={submission.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute inset-0 flex items-center justify-center bg-black/10 opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none"
            aria-label="Open video in a new tab"
          >
            <span className="rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white">
              ▶ Play
            </span>
          </a>
        )}
      </div>

      <div className="space-y-3 p-4">
        {/* Creator + status */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-3)] text-[11px] font-semibold text-[var(--text-1)]">
              {submission.creatorAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={submission.creatorAvatarUrl}
                  alt={submission.creatorName}
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                submission.creatorName
                  .split(' ')
                  .map((part) => part[0])
                  .join('')
                  .slice(0, 2)
              )}
            </div>
            <div className="flex flex-col">
              <p className="text-[13px] font-semibold text-[var(--text-1)]">
                {submission.creatorName}
              </p>
              <span className="mt-0.5 inline-flex items-center rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--text-3)]">
                {submission.platform}
              </span>
            </div>
          </div>
          <StatusBadge
            status={
              submission.status === 'approved'
                ? 'approved'
                : submission.status === 'rejected'
                  ? 'rejected'
                  : 'pending'
            }
          />
        </div>

        {/* Metrics */}
        <div className="flex items-center justify-between text-[11px] text-[var(--text-3)]">
          <div className="inline-flex items-center gap-1 tabular-nums">
            <Eye className="h-3 w-3" aria-hidden="true" />
            <span>{formatCompactNumber(submission.views)}</span>
            <span className="text-[var(--text-3)]">views</span>
          </div>
          <div className="inline-flex items-center gap-1 tabular-nums">
            <Heart className="h-3 w-3" aria-hidden="true" />
            <span>{formatCompactNumber(submission.likes)}</span>
            <span className="text-[var(--text-3)]">likes</span>
          </div>
        </div>

        {/* Rejection reason (if any) */}
        {submission.status === 'rejected' && submission.rejectionReason && (
          <p className="mt-1 text-[11px] italic text-[var(--text-3)]">
            “{submission.rejectionReason}”
          </p>
        )}

        {/* Actions */}
        <div className={cn('pt-1')}>
          <SubmissionActions
            submissionId={submission.id}
            contestId={contestId}
            status={submission.status}
          />
        </div>
      </div>
    </Card>
  );
}

