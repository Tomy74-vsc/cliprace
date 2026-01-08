'use client';

import { useRouter } from 'next/navigation';
import { RotateCcw } from 'lucide-react';
import { AdminActionPanel } from '@/components/admin/admin-action-panel';
import { Button } from '@/components/ui/button';
import { getCsrfToken } from '@/lib/csrf-client';
import { useToastContext } from '@/hooks/use-toast-context';

export function AdminWebhookDeliveryActions({
  deliveryId,
  canRetry,
}: {
  deliveryId: number;
  canRetry: boolean;
}) {
  const router = useRouter();
  const { toast } = useToastContext();

  if (!canRetry) return null;

  return (
    <AdminActionPanel
      trigger={
        <Button variant="secondary">
          <RotateCcw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      }
      title="Retry webhook delivery"
      description="Sets the delivery back to pending and increments the retry counter."
      requiresReason
      confirmLabel="Retry"
      onConfirm={async ({ reason }) => {
        try {
          const token = await getCsrfToken();
          const res = await fetch(`/api/admin/webhook-deliveries/${deliveryId}/retry`, {
            method: 'POST',
            headers: { 'x-csrf': token, 'content-type': 'application/json' },
            body: JSON.stringify({ reason }),
          });
          if (!res.ok) {
            const payload = await res.json().catch(() => ({}));
            throw new Error(payload?.message || 'Retry failed.');
          }
          toast({ type: 'success', title: 'OK', message: 'Delivery retried.' });
          router.refresh();
        } catch (error) {
          toast({
            type: 'error',
            title: 'Error',
            message: error instanceof Error ? error.message : 'Retry failed.',
          });
        }
      }}
    />
  );
}
