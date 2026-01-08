'use client';

import { useMemo, useState, type ReactNode } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import { ChevronDown, ChevronUp, Columns3 } from 'lucide-react';

import { AdminTable } from '@/components/admin/admin-table';
import { AdminEmptyStateGuided } from '@/components/admin/admin-empty-state-guided';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type AdminDataTableProProps<TData> = {
  data: TData[];
  columns: Array<ColumnDef<TData, UnsafeAny>>;
  getRowId?: (row: TData, index: number) => string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyState?: ReactNode;
  selectable?: boolean;
  bulkActions?: ReactNode | ((selected: TData[]) => ReactNode);
  initialVisibility?: VisibilityState;
  className?: string;
};

export function AdminDataTablePro<TData>({
  data,
  columns,
  getRowId,
  emptyTitle = 'Aucun résultat',
  emptyDescription = 'Aucune donnée ne correspond à vos filtres.',
  emptyState,
  selectable = true,
  bulkActions,
  initialVisibility,
  className,
}: AdminDataTableProProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(initialVisibility ?? {});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const selectionColumn = useMemo<ColumnDef<TData, UnsafeAny>>(
    () => ({
      id: '__select',
      header: ({ table }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(checked) => table.toggleAllPageRowsSelected(Boolean(checked))}
            aria-label="Sélectionner tout"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(checked) => row.toggleSelected(Boolean(checked))}
            aria-label="Sélectionner la ligne"
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
      size: 48,
    }),
    []
  );

  const table = useReactTable({
    data,
    columns: selectable ? [selectionColumn, ...columns] : columns,
    state: { sorting, columnVisibility, rowSelection },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    enableMultiSort: true,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: getRowId ? (row, index) => getRowId(row, index) : undefined,
  });

  const visibleColumns = table
    .getAllLeafColumns()
    .filter((col) => col.getCanHide() && col.id !== '__select');

  const selected = table.getSelectedRowModel().rows.map((row) => row.original);

  return (
    <div className={className}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          <span>{data.length.toLocaleString()} ligne(s)</span>
          {selected.length > 0 ? <span> • {selected.length} sélectionnée(s)</span> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selected.length > 0 && bulkActions ? (
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{selected.length}</Badge>
              {typeof bulkActions === 'function' ? bulkActions(selected) : bulkActions}
            </div>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="sm">
                <Columns3 className="h-4 w-4" />
                Colonnes
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel>Colonnes visibles</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {visibleColumns.length === 0 ? (
                <DropdownMenuItem disabled>Aucune colonne configurable</DropdownMenuItem>
              ) : (
                visibleColumns.map((col) => (
                  <DropdownMenuItem
                    key={col.id}
                    onSelect={(e) => {
                      e.preventDefault();
                      col.toggleVisibility();
                    }}
                  >
                    <Checkbox checked={col.getIsVisible()} />
                    <span className="ml-2 flex-1 truncate">
                      {typeof col.columnDef.header === 'string' ? col.columnDef.header : col.id}
                    </span>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {data.length === 0 ? (
        emptyState ?? <AdminEmptyStateGuided title={emptyTitle} description={emptyDescription} />
      ) : (
        <AdminTable>
          <thead className="text-left text-xs uppercase text-muted-foreground">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sort = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      className={canSort ? 'cursor-pointer select-none' : undefined}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                    >
                      <div className="flex items-center gap-2">
                        <span className="truncate">
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </span>
                        {sort === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : null}
                        {sort === 'desc' ? <ChevronDown className="h-3.5 w-3.5" /> : null}
                      </div>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-border">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </AdminTable>
      )}
    </div>
  );
}

