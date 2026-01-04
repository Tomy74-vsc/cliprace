import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface AdminTableProps {
  children: ReactNode;
  className?: string;
}

export function AdminTable({ children, className }: AdminTableProps) {
  return (
    <div className={cn('admin-table overflow-x-auto rounded-2xl border border-border bg-card shadow-soft', className)}>
      <table className="admin-table__table w-full text-sm">{children}</table>
    </div>
  );
}
