'use client';

import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';

import { AdminDataTablePro } from '@/components/admin/admin-data-table-pro';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/formatters';

export type AdminUserRow = {
  id: string;
  email: string;
  display_name: string | null;
  role: string;
  is_active: boolean;
  onboarding_complete: boolean;
  created_at: string;
  updated_at: string;
};

function roleVariant(role: string): BadgeProps['variant'] {
  if (role === 'admin') return 'info';
  if (role === 'brand') return 'secondary';
  return 'default';
}

export function AdminUsersTableClient({ items }: { items: AdminUserRow[] }) {
  const columns: Array<ColumnDef<AdminUserRow, UnsafeAny>> = [
    {
      id: 'user',
      header: 'User',
      accessorFn: (row) => row.display_name || row.email,
      cell: ({ row }) => {
        const user = row.original;
        return (
          <div className="min-w-0">
            <div className="font-medium truncate">{user.display_name || user.email}</div>
            <div className="text-xs text-muted-foreground truncate">{user.email}</div>
            <div className="text-xs text-muted-foreground truncate">{user.id}</div>
          </div>
        );
      },
    },
    {
      accessorKey: 'role',
      header: 'Role',
      cell: ({ row }) => <Badge variant={roleVariant(row.original.role)}>{row.original.role}</Badge>,
    },
    {
      accessorKey: 'is_active',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.is_active ? 'success' : 'danger'}>
          {row.original.is_active ? 'active' : 'inactive'}
        </Badge>
      ),
    },
    {
      accessorKey: 'onboarding_complete',
      header: 'Onboarding',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {row.original.onboarding_complete ? 'complete' : 'pending'}
        </span>
      ),
    },
    {
      accessorKey: 'created_at',
      header: 'Created',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">{formatDateTime(row.original.created_at)}</span>
      ),
    },
    {
      id: '__actions',
      header: 'Actions',
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => (
        <Button asChild variant="secondary" size="sm">
          <Link href={`/app/admin/users/${row.original.id}`}>Details</Link>
        </Button>
      ),
    },
  ];

  return (
    <AdminDataTablePro
      data={items}
      columns={columns}
      getRowId={(row) => row.id}
      emptyTitle="No users found"
      emptyDescription="No users match the current filters."
    />
  );
}
