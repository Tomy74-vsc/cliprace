export default function NewContestLoading() {
  return (
    <div className="brand-scope px-6 pt-6">
      <div className="mb-4 h-6 w-48 rounded-[var(--r2)] bg-[var(--surface-2)] animate-pulse" />

      <div className="mt-4 flex items-center gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-1 items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-[var(--surface-2)] animate-pulse" />
            {i < 4 && (
              <div className="h-px flex-1 rounded-full bg-[var(--surface-2)] animate-pulse" />
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 h-96 rounded-[var(--r3)] bg-[var(--surface-2)] animate-pulse" />

      <div className="mt-6 flex items-center justify-between">
        <div className="h-10 w-32 rounded-[var(--r2)] bg-[var(--surface-2)] animate-pulse" />
        <div className="flex gap-3">
          <div className="h-10 w-32 rounded-[var(--r2)] bg-[var(--surface-2)] animate-pulse" />
          <div className="h-10 w-32 rounded-[var(--r2)] bg-[var(--surface-2)] animate-pulse" />
        </div>
      </div>
    </div>
  );
}

