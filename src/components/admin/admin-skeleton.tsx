import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * Skeleton pour le header de page admin
 */
export function AdminPageHeaderSkeleton() {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-5 rounded-lg" />
          <Skeleton className="h-7 w-48" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
      <Skeleton className="h-4 w-96 max-w-full" />
    </div>
  );
}

/**
 * Skeleton pour la barre de filtres
 */
export function AdminFiltersSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-border bg-card p-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-10 w-32" />
        </div>
      ))}
      <Skeleton className="h-10 w-24" />
    </div>
  );
}

/**
 * Skeleton pour une table admin
 */
export function AdminTableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-soft">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} className="px-4 py-3 text-left">
                <Skeleton className="h-4 w-24" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <tr key={rowIdx} className="border-b border-border last:border-0">
              {Array.from({ length: cols }).map((_, colIdx) => (
                <td key={colIdx} className="px-4 py-3">
                  <Skeleton className={cn('h-4', colIdx === 0 ? 'w-32' : 'w-24')} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Skeleton pour une card de statistique
 */
export function AdminStatCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-32" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-16" />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton pour une grille de cards
 */
export function AdminCardsGridSkeleton({ count = 4, cols = 4 }: { count?: number; cols?: number }) {
  const gridColsClass =
    cols === 2
      ? 'md:grid-cols-2'
      : cols === 3
        ? 'md:grid-cols-2 xl:grid-cols-3'
        : cols === 4
          ? 'md:grid-cols-2 xl:grid-cols-4'
          : 'md:grid-cols-2 xl:grid-cols-4';
  return (
    <div className={cn('grid gap-4', gridColsClass)}>
      {Array.from({ length: count }).map((_, i) => (
        <AdminStatCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton pour une liste d'items
 */
export function AdminListSkeleton({ items = 5 }: { items?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-card p-4">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton pour une card avec header et content
 */
export function AdminCardSkeleton({ showHeader = true }: { showHeader?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-soft">
      {showHeader && (
        <div className="border-b border-border p-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
      )}
      <div className="p-4 space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}

/**
 * Skeleton pour le dashboard admin
 */
export function AdminDashboardSkeleton() {
  return (
    <section className="space-y-8">
      <AdminPageHeaderSkeleton />

      {/* Section Aujourd'hui */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-10 rounded-2xl" />
          <div className="space-y-1">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <AdminCardsGridSkeleton count={4} cols={4} />
        <AdminCardsGridSkeleton count={3} cols={3} />
      </div>

      {/* Section À faire */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-10 rounded-2xl" />
            <div className="space-y-1">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-6 w-24" />
          </div>
        </div>
        <AdminListSkeleton items={3} />
      </div>

      {/* Section Marketing */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-10 rounded-2xl" />
          <div className="space-y-1">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <AdminCardSkeleton />
          <AdminCardSkeleton />
          <AdminCardSkeleton />
        </div>
      </div>
    </section>
  );
}

/**
 * Skeleton pour une page de liste avec table
 */
export function AdminListPageSkeleton() {
  return (
    <section className="space-y-6">
      <AdminPageHeaderSkeleton />
      <AdminFiltersSkeleton count={3} />
      <AdminTableSkeleton rows={10} cols={5} />
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
    </section>
  );
}

