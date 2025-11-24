import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} />;
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <Skeleton className="h-4 w-20 mb-3" />
      <Skeleton className="h-8 w-24 mb-2" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}

export function ContestCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card space-y-3">
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-24" />
      <div className="flex gap-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <Skeleton className="h-9 w-full rounded-lg" />
    </div>
  );
}

export function LeaderboardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card space-y-3">
      <Skeleton className="h-5 w-24" />
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="ml-auto h-4 w-16" />
        </div>
      ))}
    </div>
  );
}
