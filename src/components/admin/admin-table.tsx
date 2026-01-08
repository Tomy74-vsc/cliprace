import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface AdminTableProps {
  children: ReactNode;
  className?: string;
}

export function AdminTable({ children, className }: AdminTableProps) {
  return (
    <div 
      className={cn(
        'admin-table overflow-x-auto',
        'rounded-2xl border border-border/50',
        'bg-card/80 backdrop-blur-sm',
        'shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)]',
        'dark:shadow-[0_4px_6px_-1px_rgba(0,0,0,0.3),0_2px_4px_-1px_rgba(0,0,0,0.2)]',
        'transition-all duration-300',
        className
      )}
    >
      <table className="admin-table__table w-full text-sm border-collapse">{children}</table>
    </div>
  );
}
