import Link from 'next/link';
import { Rocket } from 'lucide-react';
import { Surface, EmptyState } from '@/components/brand-ui';

interface ContestsEmptyProps {
  hasContestsAtAll: boolean;
  onClearFilters?: () => void;
}

export function ContestsEmpty({ hasContestsAtAll, onClearFilters }: ContestsEmptyProps) {
  if (!hasContestsAtAll) {
    return (
      <Surface variant="track" className="p-12 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
          <Rocket className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-[20px] font-semibold text-[var(--text-1)]">
          Launch your first campaign
        </h2>
        <p className="mt-2 text-[14px] text-[var(--text-3)] max-w-sm mx-auto">
          Create a contest, set your budget, and let creators compete to produce your best content.
        </p>
        <Link
          href="/app/brand/contests/new"
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-[var(--r2)] bg-[var(--cta-bg)] px-6 h-10 text-[14px] font-medium text-[var(--cta-fg)] hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-void)]"
        >
          Create contest
        </Link>
        <button
          type="button"
          className="mt-3 block w-full text-center text-[13px] text-[var(--accent)] hover:underline underline-offset-2"
        >
          Need help? View guide →
        </button>
      </Surface>
    );
  }

  return (
    <EmptyState
      title="No campaigns match your filters"
      description="Try adjusting your search or clearing filters."
      action={
        onClearFilters
          ? { label: 'Clear filters', onClick: onClearFilters }
          : undefined
      }
    />
  );
}

