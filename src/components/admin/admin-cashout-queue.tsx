'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { AdminActionPanel } from '@/components/admin/admin-action-panel';
import { AdminTable } from '@/components/admin/admin-table';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToastContext } from '@/hooks/use-toast-context';
import { formatCurrency, formatDateTime } from '@/lib/formatters';
import { getCsrfToken } from '@/lib/csrf-client';

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

export function AdminCashoutQueue({ items, canWrite = true }: AdminCashoutQueueProps) {
  const router = useRouter();
  const { toast } = useToastContext();
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  const runAction = async (id: string, action: 'approve' | 'reject' | 'hold', reason?: string) => {
    if (!canWrite) {
      toast({
        type: 'warning',
        title: 'Read only',
        message: 'You do not have permission to run finance actions.',
      });
      return;
    }

    setLoadingKey(`${id}:${action}`);
    try {
      const token = await getCsrfToken();
      const isReviewAction = action === 'approve' || action === 'reject';
      const endpoint = isReviewAction
        ? `/api/admin/cashouts/${id}/review`
        : `/api/admin/cashouts/${id}/hold`;

      const payload =
        isReviewAction
          ? {
              decision: action,
              // Motif par défaut pour approve si aucun n'est fourni
              reason:
                reason ||
                (action === 'approve'
                  ? 'Approved from admin cashout queue'
                  : 'No reason provided'),
            }
          : {
              reason,
            };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-csrf': token },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorPayload = (await res.json().catch(() => ({}))) as {
          message?: string;
          code?: string;
        };

        let message = errorPayload?.message || 'Action failed.';

        if (res.status === 403) {
          message = "Accès refusé. Vous n'avez pas les droits nécessaires pour cette action.";
        } else if (res.status === 409) {
          const lower = (errorPayload?.message || '').toLowerCase();
          if (lower.includes('already paid')) {
            message = 'Ce cashout a déjà été payé.';
          } else {
            message = "Ce cashout ne peut pas être modifié dans son état actuel.";
          }
        }

        throw new Error(message);
      }

      toast({
        type: 'success',
        title: 'Action complete',
        message:
          action === 'approve'
            ? 'Cashout approved.'
            : action === 'hold'
              ? 'Cashout placed on hold.'
              : 'Cashout rejected.',
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
          <th>Creator</th>
          <th>Amount</th>
          <th>Status</th>
          <th>KYC</th>
          <th>Risk</th>
          <th>Requested</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {items.length === 0 ? (
          <tr>
            <td colSpan={7} className="py-10 text-center text-muted-foreground">
              No cashouts found.
            </td>
          </tr>
        ) : (
          items.map((cashout) => {
            const onHold = Boolean(cashout.metadata && (cashout.metadata as UnsafeAny).on_hold);
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
                  {onHold ? <div className="mt-1 text-xs text-muted-foreground">On hold</div> : null}
                </td>
                <td className="text-xs text-muted-foreground">
                  {cashout.kyc ? `${cashout.kyc.provider} - ${cashout.kyc.status}` : 'None'}
                </td>
                <td className="text-xs text-muted-foreground">{cashout.open_risk_flags} open</td>
                <td className="text-xs text-muted-foreground">
                  {formatDateTime(cashout.requested_at)}
                  {cashout.processed_at ? ` - ${formatDateTime(cashout.processed_at)}` : ''}
                </td>
                <td>
                  <div className="flex flex-wrap gap-2">
                    {cashout.status === 'requested' ? (
                      <>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={async () => {
                            try {
                              await runAction(cashout.id, 'approve');
                            } catch (error) {
                              toast({
                                type: 'error',
                                title: 'Action impossible',
                                message:
                                  error instanceof Error
                                    ? error.message
                                    : "Une erreur s'est produite.",
                              });
                            }
                          }}
                          loading={loadingKey === `${cashout.id}:approve`}
                          disabled={!canWrite}
                        >
                          Approve
                        </Button>
                        <AdminActionPanel
                          trigger={
                            <Button size="sm" variant="secondary" disabled={!canWrite}>
                              Hold
                            </Button>
                          }
                          title="Place this cashout on hold"
                          description="Add a reason (recorded in the audit log)."
                          requiresReason
                          confirmLabel="Hold cashout"
                          confirmVariant="secondary"
                          reasonLabel="Reason"
                          preview={preview}
                          onConfirm={({ reason }) => runAction(cashout.id, 'hold', reason)}
                        />
                        <AdminActionPanel
                          trigger={
                            <Button size="sm" variant="destructive" disabled={!canWrite}>
                              Reject
                            </Button>
                          }
                          title="Reject this cashout"
                          description="Add a reason (recorded in the audit log)."
                          requiresReason
                          confirmLabel="Reject cashout"
                          confirmVariant="destructive"
                          reasonLabel="Reason"
                          preview={preview}
                          onConfirm={({ reason }) => runAction(cashout.id, 'reject', reason)}
                        />
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">No actions</span>
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
