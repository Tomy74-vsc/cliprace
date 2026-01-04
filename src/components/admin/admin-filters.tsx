import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface AdminFiltersProps {
  children: ReactNode;
  className?: string;
}

export function AdminFilters({ children, className }: AdminFiltersProps) {
  return (
    <div
      className={cn(
        'admin-filters flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft',
        className
      )}
    >
      {children}
    </div>
  );
}
