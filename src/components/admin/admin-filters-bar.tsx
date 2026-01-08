import Link from 'next/link';
import { type ReactNode } from 'react';
import { AdminFilters } from '@/components/admin/admin-filters';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type AdminFiltersBarProps = {
  children: ReactNode;
  resultsCount?: number;
  resetHref?: string;
  actions?: ReactNode;
  className?: string;
  filtersClassName?: string;
};

export function AdminFiltersBar({
  children,
  resultsCount,
  resetHref,
  actions,
  className,
  filtersClassName,
}: AdminFiltersBarProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          {typeof resultsCount === 'number' ? `${resultsCount.toLocaleString()} result(s)` : null}
        </div>
        <div className="flex items-center gap-2">
          {resetHref ? (
            <Button asChild variant="ghost" size="sm">
              <Link href={resetHref}>Reset</Link>
            </Button>
          ) : null}
          {actions}
        </div>
      </div>
      <AdminFilters className={filtersClassName}>{children}</AdminFilters>
    </div>
  );
}
