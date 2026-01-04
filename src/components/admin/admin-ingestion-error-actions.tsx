'use client';

import { useRouter } from 'next/navigation';
import { CheckCircle2, Undo2 } from 'lucide-react';
import { AdminActionPanel } from '@/components/admin/admin-action-panel';
import { Button } from '@/components/ui/button';
import { useToastContext } from '@/hooks/use-toast-context';

async function getCsrfToken(): Promise<string> {
  const res = await fetch('/api/auth/csrf');
  const data = await res.json();
  return data.token || '';
}

export function AdminIngestionErrorActions({
  errorId,
  isResolved,
  canWrite,
}: {
  errorId: number;
  isResolved: boolean;
  canWrite: boolean;
}) {
  const router = useRouter();
  const { toast } = useToastContext();

  if (!canWrite) return null;

  return (
    <AdminActionPanel
      trigger={
        <Button size="sm" variant={isResolved ? 'secondary' : 'primary'}>
          {isResolved ? <Undo2 className="h-4 w-4 mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
          {isResolved ? 'Réouvrir' : 'Résoudre'}
        </Button>
      }
      title={isResolved ? 'Réouvrir cette erreur' : 'Marquer cette erreur comme résolue'}
      description="Permet de garder une inbox ingestion propre (sans supprimer l’historique)."
      requiresReason
      confirmLabel={isResolved ? 'Réouvrir' : 'Résoudre'}
      onConfirm={async ({ reason }) => {
        try {
          const token = await getCsrfToken();
          const res = await fetch(`/api/admin/ingestion-errors/${errorId}/resolve`, {
            method: 'POST',
            headers: { 'x-csrf': token, 'content-type': 'application/json' },
            body: JSON.stringify({ resolved: !isResolved, reason }),
          });
          if (!res.ok) {
            const payload = await res.json().catch(() => ({}));
            throw new Error(payload?.message || 'Action impossible.');
          }
          toast({ type: 'success', title: 'OK', message: isResolved ? 'Erreur réouverte.' : 'Erreur résolue.' });
          router.refresh();
        } catch (error) {
          toast({
            type: 'error',
            title: 'Erreur',
            message: error instanceof Error ? error.message : 'Action impossible.',
          });
        }
      }}
    />
  );
}

