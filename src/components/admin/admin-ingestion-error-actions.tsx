'use client';

import { useRouter } from 'next/navigation';
import { CheckCircle2, Undo2 } from 'lucide-react';
import { AdminActionPanel } from '@/components/admin/admin-action-panel';
import { Button } from '@/components/ui/button';
import { getCsrfToken } from '@/lib/csrf-client';
import { useToastContext } from '@/hooks/use-toast-context';

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
          {isResolved ? 'Reopen' : 'Resolve'}
        </Button>
      }
      title={isResolved ? 'Reopen this error' : 'Mark this error as resolved'}
      description="Keeps the ingestion inbox clean without deleting history."
      requiresReason
      confirmLabel={isResolved ? 'Reopen' : 'Resolve'}
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
            throw new Error(payload?.message || 'Action failed.');
          }
          toast({
            type: 'success',
            title: 'OK',
            message: isResolved ? 'Error reopened.' : 'Error resolved.',
          });
          router.refresh();
        } catch (error) {
          toast({
            type: 'error',
            title: 'Error',
            message: error instanceof Error ? error.message : 'Action failed.',
          });
        }
      }}
    />
  );
}
