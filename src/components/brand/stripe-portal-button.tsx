'use client';

import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

type StripePortalButtonProps = {
  enabled: boolean;
  disabledMessage?: string;
};

export function StripePortalButton({ enabled, disabledMessage }: StripePortalButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleOpenPortal() {
    if (!enabled) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/payments/brand/portal', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      });

      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        url?: string;
      };

      if (!response.ok || !payload.url) {
        setError(payload.message || 'Impossible d ouvrir le portail de facturation');
        return;
      }

      window.location.assign(payload.url);
    } catch (requestError) {
      console.error('stripe_portal_button:error', requestError);
      setError('Erreur reseau lors de l ouverture du portail');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        size="md"
        variant="primary"
        loading={loading}
        onClick={handleOpenPortal}
        disabled={!enabled}
        className="w-full sm:w-auto"
      >
        <ExternalLink className="h-4 w-4" />
        Ouvrir le portail securise
      </Button>

      {!enabled && disabledMessage ? (
        <p className="text-sm text-muted-foreground">{disabledMessage}</p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
