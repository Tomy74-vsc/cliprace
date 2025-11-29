import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/creator/skeletons';

export default function NotificationsLoading() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 space-y-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Skeleton className="h-7 w-40" />
          <Skeleton className="mt-2 h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-40 rounded-full" />
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-background/80 p-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-8 w-28 rounded-full" />
        ))}
      </div>

      <section>
        {[...Array(2)].map((_, i) => (
          <Card key={i} className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>
                <Skeleton className="h-4 w-32" />
              </CardTitle>
              <Skeleton className="h-3 w-16" />
            </CardHeader>
            <CardContent className="space-y-3">
              {[...Array(3)].map((__, j) => (
                <div key={j} className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-64" />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}

