'use client';

import { useRouter } from 'next/navigation';
import { RotateCcw } from 'lucide-react';
import { AdminActionPanel } from '@/components/admin/admin-action-panel';
import { Button } from '@/components/ui/button';
import { useToastContext } from '@/hooks/use-toast-context';

async function getCsrfToken(): Promise<string> {
  const res = await fetch('/api/auth/csrf');
  const data = await res.json();
  return data.token || '';
}

export function AdminIngestionJobActions({
  jobId,
  status,
  canWrite,
}: {
  jobId: number;
  status: string;
  canWrite: boolean;
}) {
  const router = useRouter();
  const { toast } = useToastContext();

  if (!canWrite) return null;
  if (status !== 'failed') return null;

  return (
    <AdminActionPanel
      trigger={
        <Button size="sm" variant="secondary">
          <RotateCcw className="h-4 w-4 mr-2" />
          Relancer
        </Button>
      }
      title="Relancer ce job d’ingestion"
      description="Repasse le job en “queued” pour qu’il soit repris par l’ingestion."
      requiresReason
      confirmLabel="Relancer"
      onConfirm={async ({ reason }) => {
        try {
          const token = await getCsrfToken();
          const res = await fetch(`/api/admin/ingestion-jobs/${jobId}/rerun`, {
            method: 'POST',
            headers: { 'x-csrf': token, 'content-type': 'application/json' },
            body: JSON.stringify({ reason }),
          });
          if (!res.ok) {
            const payload = await res.json().catch(() => ({}));
            throw new Error(payload?.message || 'Relance impossible.');
          }
          toast({ type: 'success', title: 'OK', message: 'Job relancé.' });
          router.refresh();
        } catch (error) {
          toast({
            type: 'error',
            title: 'Erreur',
            message: error instanceof Error ? error.message : 'Relance impossible.',
          });
        }
      }}
    />
  );
}

