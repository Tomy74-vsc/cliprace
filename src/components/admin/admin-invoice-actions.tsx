'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { AdminActionPanel } from '@/components/admin/admin-action-panel';
import { Button } from '@/components/ui/button';
import { useToastContext } from '@/hooks/use-toast-context';
import { getCsrfToken } from '@/lib/csrf-client';

interface AdminInvoiceActionsProps {
  invoiceId: string;
  status: string;
  hasPdf: boolean;
  canWrite?: boolean;
}

export function AdminInvoiceActions({ invoiceId, status, hasPdf, canWrite = true }: AdminInvoiceActionsProps) {
  const router = useRouter();
  const { toast } = useToastContext();
  const [loadingGenerate, setLoadingGenerate] = useState(false);

  const runAction = async (action: 'generate' | 'void', reason?: string) => {
    if (!canWrite) {
      toast({
        type: 'warning',
        title: 'Lecture seule',
        message: "Vous n'avez pas la permission de modifier les factures.",
      });
      return;
    }

    const token = await getCsrfToken();
    const res = await fetch(`/api/admin/invoices/${invoiceId}/${action}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf': token },
      body: action === 'void' ? JSON.stringify({ reason }) : undefined,
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      throw new Error(payload?.message || 'Action failed.');
    }

    toast({
      type: 'success',
      title: 'OK',
      message: action === 'generate' ? 'PDF généré.' : "Avoir créé.",
    });
    router.refresh();
  };

  const canVoid = status !== 'void';

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        variant="secondary"
        loading={loadingGenerate}
        disabled={!canWrite}
        onClick={async () => {
          try {
            setLoadingGenerate(true);
            await runAction('generate');
          } catch (error) {
            toast({
              type: 'error',
              title: 'Error',
              message: error instanceof Error ? error.message : 'Action failed.',
            });
          } finally {
            setLoadingGenerate(false);
          }
        }}
      >
        {hasPdf ? 'Régénérer le PDF' : 'Générer le PDF'}
      </Button>

      {canVoid ? (
        <AdminActionPanel
          trigger={
            <Button size="sm" variant="destructive" disabled={!canWrite}>
              Créer un avoir
            </Button>
          }
          title="Créer un avoir"
          description="Annule la facture et génère un document d'avoir."
          requiresReason
          reasonLabel="Raison"
          reasonPlaceholder="Pourquoi annuler cette facture ?"
          confirmLabel="Créer l'avoir"
          confirmVariant="destructive"
          onConfirm={async ({ reason }) => {
            await runAction('void', reason);
          }}
        />
      ) : null}
    </div>
  );
}
