import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import { Panel, DataTable, StatusBadge, type StatusKey } from '@/components/brand-ui';
import type { RecentContest } from '../_types';

interface RecentContestsTableProps {
  contests: RecentContest[];
}

export function RecentContestsTable({ contests }: RecentContestsTableProps) {
  const columns: ColumnDef<RecentContest>[] = [
    {
      header: 'Title',
      accessorKey: 'title',
      cell: ({ row }) => (
        <Link
          href={`/app/brand/contests/${row.original.id}`}
          className="text-[var(--text-1)] hover:underline"
        >
          {row.original.title}
        </Link>
      ),
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ row }) => (
        <StatusBadge status={row.original.status as StatusKey} />
      ),
    },
    {
      header: 'Submissions',
      accessorKey: 'submissionCount',
      meta: { numeric: true },
      cell: ({ row }) => row.original.submissionCount,
    },
    {
      header: 'Views',
      accessorKey: 'totalViews',
      meta: { numeric: true },
      cell: ({ row }) => row.original.totalViews,
    },
    {
      header: 'Ends',
      accessorKey: 'endAt',
      cell: ({ row }) => new Date(row.original.endAt).toLocaleDateString(),
    },
  ];

  return (
    <Panel
      title="Recent campaigns"
      action={
        <Link
          href="/app/brand/contests"
          className="text-xs font-medium text-[var(--text-3)] hover:text-[var(--text-2)]"
        >
          View all →
        </Link>
      }
    >
      <DataTable
        columns={columns}
        data={contests}
        pageSize={5}
        pagination={false}
      />
    </Panel>
  );
}

