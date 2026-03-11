'use client';

/**
 * DataTable — Generic finance-grade table using TanStack Table.
 * Client component.
 */
import { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SkeletonTable } from './Skeleton';
import { EmptyState } from './EmptyState';

/* ── Types ── */

export interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  loading?: boolean;
  emptyState?: React.ReactNode;
  onRowClick?: (row: TData) => void;
  pagination?: boolean;
  pageSize?: number;
  className?: string;
}

/* ── Component ── */

export function DataTable<TData>({
  columns,
  data,
  loading = false,
  emptyState,
  onRowClick,
  pagination = false,
  pageSize = 10,
  className,
}: DataTableProps<TData>) {
  const [pageIndex, setPageIndex] = useState(0);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    ...(pagination
      ? {
          getPaginationRowModel: getPaginationRowModel(),
          state: { pagination: { pageIndex, pageSize } },
          onPaginationChange: (updater) => {
            const next =
              typeof updater === 'function'
                ? updater({ pageIndex, pageSize })
                : updater;
            setPageIndex(next.pageIndex);
          },
        }
      : {}),
  });

  if (loading) {
    return (
      <SkeletonTable
        rows={pageSize > 5 ? 5 : pageSize}
        cols={columns.length}
        className={className}
      />
    );
  }

  if (data.length === 0) {
    return (
      <div className={className}>
        {emptyState ?? (
          <EmptyState
            title="Aucune donnée"
            description="Rien à afficher pour le moment."
          />
        )}
      </div>
    );
  }

  return (
    <div className={cn('brand-scope', className)}>
      <div className="overflow-x-auto rounded-[var(--r3)] border border-[var(--border-1)]">
        <table className="w-full border-collapse">
          {/* Header */}
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="bg-[var(--surface-2)]">
                {hg.headers.map((header) => {
                  const meta = header.column.columnDef.meta as
                    | { numeric?: boolean }
                    | undefined;
                  return (
                    <th
                      key={header.id}
                      className={cn(
                        'px-4 py-3 text-[11px] font-medium uppercase tracking-wide text-[var(--text-3)]',
                        'border-b border-[var(--border-1)] text-left',
                        meta?.numeric && 'text-right',
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          {/* Body */}
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                onClick={
                  onRowClick
                    ? () => onRowClick(row.original)
                    : undefined
                }
                className={cn(
                  'border-b border-[var(--border-1)] last:border-b-0',
                  'transition-colors hover:bg-[var(--surface-2)]',
                  onRowClick && 'cursor-pointer',
                )}
              >
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta as
                    | { numeric?: boolean }
                    | undefined;
                  return (
                    <td
                      key={cell.id}
                      className={cn(
                        'px-4 py-3 text-[14px] text-[var(--text-2)]',
                        meta?.numeric && 'text-right tabular-nums',
                      )}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && table.getPageCount() > 1 && (
        <div className="flex items-center justify-between pt-3 px-1">
          <span className="text-[12px] text-[var(--text-3)]">
            Page {pageIndex + 1} / {table.getPageCount()}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
              disabled={!table.getCanPreviousPage()}
              className={cn(
                'rounded-[var(--r2)] p-1.5 text-[var(--text-2)]',
                'hover:bg-[var(--surface-2)] transition-colors',
                'disabled:opacity-30 disabled:cursor-not-allowed',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)]',
              )}
              aria-label="Page précédente"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() =>
                setPageIndex((p) => Math.min(table.getPageCount() - 1, p + 1))
              }
              disabled={!table.getCanNextPage()}
              className={cn(
                'rounded-[var(--r2)] p-1.5 text-[var(--text-2)]',
                'hover:bg-[var(--surface-2)] transition-colors',
                'disabled:opacity-30 disabled:cursor-not-allowed',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)]',
              )}
              aria-label="Page suivante"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataTable;
