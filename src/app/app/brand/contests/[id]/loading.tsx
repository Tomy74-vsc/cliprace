
const sk = 'animate-pulse rounded bg-[var(--surface-2)]';
const skCard = 'rounded-[var(--r3)] border border-[var(--border-1)] bg-[var(--surface-1)]/80';

export default function BrandContestDetailLoading() {
  return (
    <main className="space-y-8 mx-auto max-w-7xl px-4 lg:px-6 py-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className={`h-8 w-64 ${sk}`} />
            <div className={`h-6 w-20 rounded-[var(--r-pill)] ${sk}`} />
          </div>
          <div className={`h-4 w-48 ${sk}`} />
        </div>
        <div className="flex gap-2">
          <div className={`h-10 w-24 rounded-[var(--r2)] ${sk}`} />
          <div className={`h-10 w-32 rounded-[var(--r2)] ${sk}`} />
          <div className={`h-10 w-28 rounded-[var(--r2)] ${sk}`} />
        </div>
      </div>

      {/* 4 stat cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className={`${skCard} p-5 space-y-3`}>
            <div className={`h-3 w-24 ${sk}`} />
            <div className={`h-7 w-20 ${sk}`} />
            <div className={`h-3 w-32 ${sk}`} />
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className={`${skCard} p-6 space-y-4`}>
        <div className={`h-5 w-48 ${sk}`} />
        <div className={`h-[220px] rounded-[var(--r2)] ${sk}`} />
      </div>

      {/* Leaderboard preview / submissions */}
      <div className={`${skCard} p-0 overflow-hidden`}>
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 p-4 border-b border-[var(--border-1)] last:border-0"
          >
            <div className={`h-8 w-8 rounded-full ${sk}`} />
            <div className="flex-1 space-y-1.5">
              <div className={`h-4 w-32 ${sk}`} />
              <div className={`h-3 w-48 ${sk}`} />
            </div>
            <div className={`h-4 w-16 ${sk}`} />
          </div>
        ))}
      </div>
    </main>
  );
}

