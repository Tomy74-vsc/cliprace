/*
Source: Button to open a messaging thread with the contest brand
*/
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToastContext } from '@/hooks/use-toast-context';
import { useCsrfToken } from '@/hooks/use-csrf-token';

interface ContactBrandButtonProps {
  contestId: string;
  brandId: string;
  className?: string;
}

export function ContactBrandButton({ contestId, brandId, className }: ContactBrandButtonProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToastContext();
  const router = useRouter();
  const csrfToken = useCsrfToken();

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const response = await fetch('/api/messages/threads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf': csrfToken || '',
        },
        body: JSON.stringify({
          participant_id: brandId,
          contest_id: contestId,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.thread_id) {
        throw new Error(result.message || 'Impossible de créer la conversation');
      }
      toast({
        type: 'success',
        title: 'Conversation ouverte',
        message: 'Vous pouvez échanger avec la marque.',
      });
      router.push(`/app/creator/messages?thread=${result.thread_id}`);
    } catch (error) {
      toast({
        type: 'error',
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Une erreur est survenue',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="secondary"
      onClick={handleClick}
      disabled={loading}
      className={className}
    >
      {loading ? 'Ouverture…' : 'Contacter la marque'}
    </Button>
  );
}
