import { SkeletonLine, SkeletonBlock, SkeletonTable } from '@/components/brand-ui';

export default function BrandContestsLoading() {
  return (
    <div className="brand-scope max-w-7xl mx-auto px-6 py-8 space-y-4" aria-busy="true" aria-label="Loading campaigns">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <SkeletonLine width="180px" height="24px" />
          <SkeletonLine width="260px" height="14px" />
        </div>
        <SkeletonBlock width="140px" height="36px" rounded="var(--r2)" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 mt-2">
        <SkeletonBlock width="260px" height="36px" rounded="var(--r2)" />
        <div className="flex items-center gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonBlock key={i} width="60px" height="28px" rounded="999px" />
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="mt-4">
        <SkeletonTable rows={8} cols={7} />
      </div>
    </div>
  );
}

export default function BrandContestsLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 lg:px-6 py-8 space-y-10">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-7 w-40 animate-pulse rounded-lg bg-[var(--surface-2)]" />
          <div className="h-4 w-32 animate-pulse rounded bg-[var(--surface-2)]" />
        </div>
        <div className="h-10 w-44 animate-pulse rounded-[var(--r2)] bg-[var(--surface-2)]" />
      </div>

      {/* Section Live */}
      <div className="space-y-3">
        <div className="h-5 w-28 animate-pulse rounded bg-[var(--surface-2)]" />
        {[...Array(2)].map((_, i) => (
          <div
            key={i}
            className="flex h-[130px] rounded-[var(--r3)] border border-[var(--border-1)] bg-[var(--surface-1)]/80 overflow-hidden"
          >
            <div className="w-[200px] shrink-0 animate-pulse bg-[var(--surface-2)]" />
            <div className="flex-1 p-5 space-y-3">
              <div className="h-5 w-48 animate-pulse rounded bg-[var(--surface-2)]" />
              <div className="flex gap-6">
                <div className="h-4 w-16 animate-pulse rounded bg-[var(--surface-2)]" />
                <div className="h-4 w-16 animate-pulse rounded bg-[var(--surface-2)]" />
                <div className="h-4 w-16 animate-pulse rounded bg-[var(--surface-2)]" />
              </div>
              <div className="flex gap-2">
                <div className="h-7 w-28 animate-pulse rounded-[var(--r2)] bg-[var(--surface-2)]" />
                <div className="h-7 w-24 animate-pulse rounded-[var(--r2)] bg-[var(--surface-2)]" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Section Drafts */}
      <div className="space-y-3">
        <div className="h-5 w-24 animate-pulse rounded bg-[var(--surface-2)]" />
        <div className="flex h-[130px] rounded-[var(--r3)] border border-[var(--border-1)] bg-[var(--surface-1)]/80 overflow-hidden">
          <div className="w-[200px] shrink-0 animate-pulse bg-[var(--surface-2)]" />
          <div className="flex-1 p-5 space-y-3">
            <div className="h-5 w-36 animate-pulse rounded bg-[var(--surface-2)]" />
            <div className="h-4 w-48 animate-pulse rounded bg-[var(--surface-2)]" />
            <div className="h-7 w-28 animate-pulse rounded-[var(--r2)] bg-[var(--surface-2)]" />
          </div>
        </div>
      </div>
    </div>
  );
}
