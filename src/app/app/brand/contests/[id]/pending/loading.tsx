const sk = 'animate-pulse rounded bg-[var(--surface-2)]';
const skCard = 'rounded-[var(--r3)] border border-[var(--border-1)] bg-[var(--surface-1)]/80';

export default function PendingLiveLoading() {
  return (
    <main className="mx-auto max-w-2xl px-4 lg:px-6 py-8">
      <div className={`${skCard} space-y-6 p-6`}>
        <div className={`h-5 w-32 ${sk}`} />
        <div className={`h-7 w-56 ${sk}`} />
        <div className={`h-4 w-full ${sk}`} />
        <div className="flex justify-center gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={`h-14 w-16 ${sk}`} />
          ))}
        </div>
      </div>
      <div className="mt-6 text-center">
        <div className={`mx-auto h-4 w-24 ${sk}`} />
      </div>
    </main>
  );
}
