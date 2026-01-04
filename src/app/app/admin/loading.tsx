import { Skeleton } from '@/components/ui/skeleton';

export default function AdminLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 lg:px-8 py-6 space-y-4">
      <Skeleton className="h-20 rounded-3xl" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </main>
  );
}

