import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton as UiSkeleton } from '@/components/ui/skeleton';
import { StatCardSkeleton } from '@/components/creator/skeletons';

export default function DashboardLoading() {
  return (
    <main className="space-y-8 mx-auto max-w-6xl px-4 py-8">
      <section className="rounded-3xl border border-border bg-gradient-to-r from-primary/10 via-accent/5 to-background p-6 md:p-8 shadow-card">
        <div className="grid gap-6 md:grid-cols-[2fr,1.1fr] md:items-center">
          <div className="space-y-3">
            <UiSkeleton className="h-4 w-32 rounded-full" />
            <UiSkeleton className="h-8 w-64 rounded-xl" />
            <UiSkeleton className="h-4 w-80 rounded-xl" />
            <div className="flex flex-wrap gap-3">
              <UiSkeleton className="h-9 w-40 rounded-full" />
              <UiSkeleton className="h-9 w-40 rounded-full" />
            </div>
          </div>
          <Card className="bg-card/80 backdrop-blur-xl border-dashed border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <UiSkeleton className="h-5 w-32 rounded-md" />
                <UiSkeleton className="h-6 w-20 rounded-full" />
              </div>
              <UiSkeleton className="mt-2 h-4 w-40 rounded-md" />
            </CardHeader>
            <CardContent className="space-y-3">
              <UiSkeleton className="h-4 w-52 rounded-md" />
              <UiSkeleton className="h-6 w-36 rounded-full" />
            </CardContent>
          </Card>
        </div>
      </section>

      <section>
        <div className="grid gap-4 md:grid-cols-4">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>
              <UiSkeleton className="h-5 w-24 rounded-md" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <UiSkeleton className="h-4 w-full rounded-md" />
            <UiSkeleton className="h-4 w-5/6 rounded-md" />
            <UiSkeleton className="h-4 w-2/3 rounded-md" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <UiSkeleton className="h-5 w-28 rounded-md" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <UiSkeleton className="h-4 w-full rounded-md" />
            <UiSkeleton className="h-4 w-4/5 rounded-md" />
            <UiSkeleton className="h-4 w-3/5 rounded-md" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <UiSkeleton className="h-5 w-32 rounded-md" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <UiSkeleton className="h-9 w-full rounded-full" />
            <UiSkeleton className="h-4 w-40 rounded-md" />
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
