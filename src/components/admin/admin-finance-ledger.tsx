import { AdminTable } from '@/components/admin/admin-table';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { formatCurrency, formatDateTime } from '@/lib/formatters';

type LedgerEntry = {
  id: string;
  type: 'payment' | 'cashout' | 'winning';
  amount_cents: number;
  currency: string;
  status: string;
  created_at: string;
  user: { id: string; display_name: string | null; email: string } | null;
  contest: { id: string; title: string } | null;
};

interface AdminFinanceLedgerProps {
  items: LedgerEntry[];
}

function typeVariant(type: string): BadgeProps['variant'] {
  if (type === 'payment') return 'info';
  if (type === 'cashout') return 'warning';
  return 'secondary';
}

export function AdminFinanceLedger({ items }: AdminFinanceLedgerProps) {
  return (
    <AdminTable>
      <thead className="text-left text-xs uppercase text-muted-foreground">
        <tr>
          <th className="px-4 py-3">Type</th>
          <th className="px-4 py-3">Amount</th>
          <th className="px-4 py-3">Status</th>
          <th className="px-4 py-3">User</th>
          <th className="px-4 py-3">Contest</th>
          <th className="px-4 py-3">Created</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border text-sm">
        {items.length === 0 ? (
          <tr>
            <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
              No finance activity yet.
            </td>
          </tr>
        ) : (
          items.map((entry) => (
            <tr key={`${entry.type}-${entry.id}`} className="hover:bg-muted/30">
              <td className="px-4 py-4">
                <Badge variant={typeVariant(entry.type)}>{entry.type}</Badge>
              </td>
              <td className="px-4 py-4 font-medium">
                {formatCurrency(entry.amount_cents, entry.currency)}
              </td>
              <td className="px-4 py-4 text-xs text-muted-foreground">{entry.status}</td>
              <td className="px-4 py-4 text-xs">
                <div className="font-medium">{entry.user?.display_name || entry.user?.email || '-'}</div>
                <div className="text-muted-foreground">{entry.user?.id || '-'}</div>
              </td>
              <td className="px-4 py-4 text-xs text-muted-foreground">
                {entry.contest?.title || '-'}
              </td>
              <td className="px-4 py-4 text-xs text-muted-foreground">
                {formatDateTime(entry.created_at)}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </AdminTable>
  );
}
