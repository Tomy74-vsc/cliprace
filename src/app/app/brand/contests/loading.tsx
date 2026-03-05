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
