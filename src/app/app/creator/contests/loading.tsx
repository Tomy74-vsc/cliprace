import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/creator/skeletons';

export default function ContestsLoading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 space-y-6 animate-fadeUpSoft">
      <section className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-40 rounded-full" />
      </section>

      <section className="flex flex-wrap gap-2">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-9 w-28 rounded-full" />
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="shadow-card">
            <CardHeader className="space-y-2">
              <Skeleton className="h-40 w-full rounded-2xl" />
              <CardTitle>
                <Skeleton className="h-5 w-48" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-full rounded-full" />
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}

