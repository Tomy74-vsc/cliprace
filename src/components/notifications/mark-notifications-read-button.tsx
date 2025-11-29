/*
Source: Button to mark notifications as read
*/
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToastContext } from '@/hooks/use-toast-context';
import { useCsrfToken } from '@/hooks/use-csrf-token';

interface MarkNotificationsReadButtonProps {
  disabled?: boolean;
  notificationIds?: string[];
}

export function MarkNotificationsReadButton({
  disabled,
  notificationIds,
}: MarkNotificationsReadButtonProps) {
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToastContext();
  const router = useRouter();
  const csrfToken = useCsrfToken();

  const handleClick = async () => {
    if (disabled || submitting) return;
    if (!notificationIds || notificationIds.length === 0) return;

    setSubmitting(true);
    try {
      const response = await fetch('/api/notifications/read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf': csrfToken || '',
        },
        body: JSON.stringify({ ids: notificationIds }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || 'Impossible de mettre à jour les notifications');
      }
      toast({
        type: 'success',
        title: 'Notifications mises à jour',
        message: 'Toutes les notifications ont été marquées comme lues.',
      });
      router.refresh();
    } catch (error) {
      toast({
        type: 'error',
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Une erreur est survenue',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      disabled={disabled || submitting}
    >
      {submitting ? '…' : 'Tout marquer comme lu'}
    </Button>
  );
}

