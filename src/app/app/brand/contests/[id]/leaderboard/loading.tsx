const sk = 'animate-pulse rounded bg-[var(--surface-2)]';

export default function BrandContestLeaderboardLoading() {
  return (
    <main className="mx-auto max-w-5xl px-4 lg:px-6 py-8 space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className={`h-4 w-32 ${sk}`} />
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className={`h-7 w-48 ${sk}`} />
            <div className={`h-4 w-72 ${sk}`} />
          </div>
          <div className="flex gap-2">
            <div className={`h-7 w-20 rounded-[var(--r2)] ${sk}`} />
            <div className={`h-7 w-28 rounded-[var(--r2)] ${sk}`} />
          </div>
        </div>
      </div>

      {/* Podium skeleton — 3 cards côte à côte */}
      <div className="grid grid-cols-3 gap-4 items-end">
        {/* #2 — médium */}
        <div
          className="rounded-[var(--r3)] border border-[var(--border-1)]
          bg-[var(--surface-1)]/80 p-5 space-y-3 h-40"
        >
          <div className={`h-4 w-8 rounded-[var(--r-pill)] ${sk}`} />
          <div className={`h-5 w-28 ${sk}`} />
          <div className={`h-4 w-20 ${sk}`} />
        </div>
        {/* #1 — plus grand */}
        <div
          className="rounded-[var(--r3)] border border-[var(--border-1)]
          bg-[var(--surface-1)]/80 p-5 space-y-3 h-52"
        >
          <div className={`h-4 w-8 rounded-[var(--r-pill)] ${sk}`} />
          <div className={`h-6 w-32 ${sk}`} />
          <div className={`h-4 w-24 ${sk}`} />
          <div className={`h-6 w-20 ${sk}`} />
        </div>
        {/* #3 — petit */}
        <div
          className="rounded-[var(--r3)] border border-[var(--border-1)]
          bg-[var(--surface-1)]/80 p-5 space-y-3 h-32"
        >
          <div className={`h-4 w-8 rounded-[var(--r-pill)] ${sk}`} />
          <div className={`h-5 w-24 ${sk}`} />
          <div className={`h-4 w-16 ${sk}`} />
        </div>
      </div>

      {/* Table skeleton */}
      <div
        className="rounded-[var(--r3)] border border-[var(--border-1)]
        bg-[var(--surface-1)]/80 overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-[var(--border-1)]">
          <div className={`h-4 w-40 ${sk}`} />
        </div>
        {[...Array(7)].map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-5 py-3.5
            border-b border-[var(--border-1)] last:border-0"
          >
            <div className={`h-4 w-6 ${sk}`} />
            <div className={`h-8 w-8 rounded-full ${sk}`} />
            <div className={`h-4 flex-1 max-w-[160px] ${sk}`} />
            <div className={`h-4 w-16 ml-auto ${sk}`} />
            <div className={`h-4 w-12 ${sk}`} />
          </div>
        ))}
      </div>
    </main>
  );
}

