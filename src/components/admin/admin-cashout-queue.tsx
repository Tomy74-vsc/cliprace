'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { AdminActionPanel } from '@/components/admin/admin-action-panel';
import { AdminTable } from '@/components/admin/admin-table';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToastContext } from '@/hooks/use-toast-context';
import { formatCurrency, formatDateTime } from '@/lib/formatters';

type CashoutItem = {
  id: string;
  creator_id: string;
  amount_cents: number;
  currency: string;
  status: string;
  metadata: Record<string, unknown> | null;
  requested_at: string;
  processed_at: string | null;
  creator: { id: string; display_name: string | null; email: string } | null;
  kyc: { provider: string; status: string; reason: string | null; reviewed_at: string | null } | null;
  open_risk_flags: number;
};

interface AdminCashoutQueueProps {
  items: CashoutItem[];
  canWrite?: boolean;
}

function statusVariant(status: string): BadgeProps['variant'] {
  if (status === 'paid') return 'success';
  if (status === 'processing') return 'warning';
  if (status === 'failed') return 'danger';
  return 'default';
}

async function getCsrfToken(): Promise<string> {
  const res = await fetch('/api/auth/csrf');
  const data = await res.json();
  return data.token || '';
}

export function AdminCashoutQueue({ items, canWrite = true }: AdminCashoutQueueProps) {
  const router = useRouter();
  const { toast } = useToastContext();
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  const runAction = async (id: string, action: 'approve' | 'reject' | 'hold', reason?: string) => {
    if (!canWrite) {
      toast({
        type: 'warning',
        title: 'Lecture seule',
        message: "Vous n'avez pas les droits pour exécuter des actions Finance.",
      });
      return;
    }

    setLoadingKey(`${id}:${action}`);
    try {
      const token = await getCsrfToken();
      const res = await fetch(`/api/admin/cashouts/${id}/${action}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-csrf': token },
        body: action === 'approve' ? undefined : JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.message || "L'action a échoué.");
      }

      toast({
        type: 'success',
        title: 'Action effectuée',
        message:
          action === 'approve'
            ? 'Cashout approuvé.'
            : action === 'hold'
              ? 'Cashout mis en pause.'
              : 'Cashout rejeté.',
      });
      router.refresh();
    } finally {
      setLoadingKey(null);
    }
  };

  return (
    <AdminTable>
      <thead className="text-left text-xs uppercase text-muted-foreground">
        <tr>
          <th>Créateur</th>
          <th>Montant</th>
          <th>Statut</th>
          <th>KYC</th>
          <th>Risque</th>
          <th>Demandé</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {items.length === 0 ? (
          <tr>
            <td colSpan={7} className="py-10 text-center text-muted-foreground">
              Aucun cashout trouvé.
            </td>
          </tr>
        ) : (
          items.map((cashout) => {
            const onHold = Boolean(cashout.metadata && (cashout.metadata as any).on_hold);
            const creatorLabel = cashout.creator?.display_name || cashout.creator?.email || cashout.creator_id;
            const preview = (
              <div className="space-y-1">
                <div className="font-medium">{creatorLabel}</div>
                <div className="text-xs text-muted-foreground">{cashout.creator_id}</div>
                <div className="text-sm font-semibold">
                  {formatCurrency(cashout.amount_cents, cashout.currency)}
                </div>
              </div>
            );

            return (
              <tr key={cashout.id}>
                <td>
                  <div className="font-medium">{creatorLabel}</div>
                  <div className="text-xs text-muted-foreground">{cashout.creator_id}</div>
                </td>
                <td className="font-medium">{formatCurrency(cashout.amount_cents, cashout.currency)}</td>
                <td>
                  <Badge variant={statusVariant(cashout.status)}>{cashout.status}</Badge>
                  {onHold ? <div className="mt-1 text-xs text-muted-foreground">En pause</div> : null}
                </td>
                <td className="text-xs text-muted-foreground">
                  {cashout.kyc ? `${cashout.kyc.provider} • ${cashout.kyc.status}` : 'Aucun'}
                </td>
                <td className="text-xs text-muted-foreground">{cashout.open_risk_flags} ouvert(s)</td>
                <td className="text-xs text-muted-foreground">
                  {formatDateTime(cashout.requested_at)}
                  {cashout.processed_at ? ` • ${formatDateTime(cashout.processed_at)}` : ''}
                </td>
                <td>
                  <div className="flex flex-wrap gap-2">
                    {cashout.status === 'requested' ? (
                      <>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => runAction(cashout.id, 'approve')}
                          loading={loadingKey === `${cashout.id}:approve`}
                          disabled={!canWrite}
                        >
                          Approuver
                        </Button>
                        <AdminActionPanel
                          trigger={
                            <Button size="sm" variant="secondary" disabled={!canWrite}>
                              Mettre en pause
                            </Button>
                          }
                          title="Mettre en pause ce cashout"
                          description="Ajoutez une raison (visible dans l'audit)."
                          requiresReason
                          confirmLabel="Mettre en pause"
                          confirmVariant="secondary"
                          reasonLabel="Raison"
                          preview={preview}
                          onConfirm={({ reason }) => runAction(cashout.id, 'hold', reason)}
                        />
                        <AdminActionPanel
                          trigger={
                            <Button size="sm" variant="destructive" disabled={!canWrite}>
                              Rejeter
                            </Button>
                          }
                          title="Rejeter ce cashout"
                          description="Ajoutez une raison (visible dans l'audit)."
                          requiresReason
                          confirmLabel="Rejeter"
                          confirmVariant="destructive"
                          reasonLabel="Raison"
                          preview={preview}
                          onConfirm={({ reason }) => runAction(cashout.id, 'reject', reason)}
                        />
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">Aucune action</span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </AdminTable>
  );
}

