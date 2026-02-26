/**
 * Loading skeleton for Brand Contests List.
 * Matches the final layout (header + chips + filters + table/cards) to avoid CLS.
 */
export default function BrandContestsLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-7 w-36 animate-pulse rounded-lg bg-[var(--surface-2)]" />
          <div className="h-4 w-72 animate-pulse rounded bg-[var(--surface-2)]" />
        </div>
        <div className="h-10 w-44 animate-pulse rounded-[var(--r2)] bg-[var(--surface-2)]" />
      </div>

      {/* ── KPI Chips ── */}
      <div className="flex items-center gap-3">
        <div className="h-7 w-20 animate-pulse rounded-[var(--r-pill)] bg-[var(--surface-2)]" />
        <div className="h-7 w-28 animate-pulse rounded-[var(--r-pill)] bg-[var(--surface-2)]" />
      </div>

      {/* ── Filters Row ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="h-10 w-full animate-pulse rounded-[var(--r2)] bg-[var(--surface-2)] sm:max-w-xs" />
        <div className="flex items-center gap-3">
          <div className="h-9 w-60 animate-pulse rounded-[var(--r2)] bg-[var(--surface-2)]" />
          <div className="h-9 w-32 animate-pulse rounded-[var(--r2)] bg-[var(--surface-2)]" />
        </div>
      </div>

      {/* ── Desktop Table Skeleton ── */}
      <div className="hidden lg:block">
        <div className="overflow-hidden rounded-[var(--r3)] border border-[var(--border-1)] bg-[var(--surface-1)]/80">
          {/* Table header */}
          <div className="flex items-center border-b border-[var(--border-1)] px-4 py-3">
            <div className="flex-1">
              <div className="h-3 w-20 animate-pulse rounded bg-[var(--surface-2)]" />
            </div>
            <div className="w-20 px-4">
              <div className="h-3 w-12 animate-pulse rounded bg-[var(--surface-2)]" />
            </div>
            <div className="w-16 px-4">
              <div className="ml-auto h-3 w-10 animate-pulse rounded bg-[var(--surface-2)]" />
            </div>
            <div className="w-20 px-4">
              <div className="ml-auto h-3 w-14 animate-pulse rounded bg-[var(--surface-2)]" />
            </div>
            <div className="hidden xl:block w-16 px-4">
              <div className="ml-auto h-3 w-8 animate-pulse rounded bg-[var(--surface-2)]" />
            </div>
            <div className="w-20 px-4">
              <div className="mx-auto h-3 w-16 animate-pulse rounded bg-[var(--surface-2)]" />
            </div>
            <div className="w-12 px-2">
              <div className="h-3 w-4 animate-pulse rounded bg-[var(--surface-2)]" />
            </div>
          </div>

          {/* Table rows */}
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center border-b border-[var(--border-1)] px-4 py-3.5 last:border-0"
            >
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-44 animate-pulse rounded bg-[var(--surface-2)]" />
                <div className="h-3 w-20 animate-pulse rounded bg-[var(--surface-2)]" />
              </div>
              <div className="w-20 px-4">
                <div className="h-5 w-16 animate-pulse rounded-[var(--r-pill)] bg-[var(--surface-2)]" />
              </div>
              <div className="w-16 px-4">
                <div className="ml-auto h-4 w-10 animate-pulse rounded bg-[var(--surface-2)]" />
              </div>
              <div className="w-20 px-4">
                <div className="ml-auto h-4 w-14 animate-pulse rounded bg-[var(--surface-2)]" />
              </div>
              <div className="hidden xl:block w-16 px-4">
                <div className="ml-auto h-4 w-10 animate-pulse rounded bg-[var(--surface-2)]" />
              </div>
              <div className="w-20 px-4">
                <div className="mx-auto h-5 w-6 animate-pulse rounded-[var(--r-pill)] bg-[var(--surface-2)]" />
              </div>
              <div className="w-12 px-2">
                <div className="h-6 w-6 animate-pulse rounded bg-[var(--surface-2)]" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Mobile Cards Skeleton ── */}
      <div className="lg:hidden space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="rounded-[var(--r3)] border border-[var(--border-1)] bg-[var(--surface-1)]/80 p-4"
          >
            <div className="flex items-center justify-between">
              <div className="space-y-1.5">
                <div className="h-4 w-40 animate-pulse rounded bg-[var(--surface-2)]" />
                <div className="h-3 w-28 animate-pulse rounded bg-[var(--surface-2)]" />
              </div>
              <div className="h-5 w-14 animate-pulse rounded-[var(--r-pill)] bg-[var(--surface-2)]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
