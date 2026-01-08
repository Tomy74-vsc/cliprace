'use client';

import { useRouter } from 'next/navigation';
import { RotateCcw } from 'lucide-react';
import { AdminActionPanel } from '@/components/admin/admin-action-panel';
import { Button } from '@/components/ui/button';
import { getCsrfToken } from '@/lib/csrf-client';
import { useToastContext } from '@/hooks/use-toast-context';

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
          Rerun
        </Button>
      }
      title="Rerun ingestion job"
      description="Queues the job again so ingestion can retry it."
      requiresReason
      confirmLabel="Rerun"
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
            throw new Error(payload?.message || 'Rerun failed.');
          }
          toast({ type: 'success', title: 'OK', message: 'Job rerun.' });
          router.refresh();
        } catch (error) {
          toast({
            type: 'error',
            title: 'Error',
            message: error instanceof Error ? error.message : 'Rerun failed.',
          });
        }
      }}
    />
  );
}
