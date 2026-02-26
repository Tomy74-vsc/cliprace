'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useCsrfToken } from '@/hooks/use-csrf-token';
import { Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Client component that duplicates a contest server-side and redirects to the new draft's edit page.
 */
export function DuplicateContestButton({ contestId }: { contestId: string }) {
  const router = useRouter();
  const csrfToken = useCsrfToken();
  const [isLoading, setIsLoading] = useState(false);

  const handleDuplicate = async () => {
    if (!csrfToken) {
      toast.error('Token CSRF manquant. Recharge la page.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/contests/${contestId}/duplicate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf': csrfToken,
        },
        credentials: 'include',
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.message || 'Erreur lors de la duplication');
      }

      const newContestId = json.contest_id as string;
      toast.success('Concours dupliqué avec succès');
      router.push(`/app/brand/contests/${newContestId}/edit`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur lors de la duplication');
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="secondary"
      onClick={handleDuplicate}
      disabled={isLoading}
      aria-label="Dupliquer le concours"
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Copy className="h-4 w-4 mr-2" />
      )}
      Dupliquer
    </Button>
  );
}
