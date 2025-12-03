'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import type { ContestWizardData } from '../contest-wizard-client';

interface Step5PaymentProps {
  data: ContestWizardData;
  updateData: (updates: Partial<ContestWizardData>) => void;
  errors: Record<string, string>;
  userId: string;
}

export function Step5Payment({ data, updateData, userId }: Step5PaymentProps) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [isLoadingPayment, setIsLoadingPayment] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Créer le concours en brouillon et initier le paiement
  const handleCreateAndPay = async () => {
    setIsCreating(true);
    setError(null);

    try {
      // 1. Créer le concours via l'API
      const response = await fetch('/api/contests/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: data.title,
          brief_md: data.brief_md,
          cover_url: data.cover_url || undefined,
          start_at: data.start_at,
          end_at: data.end_at,
          allowed_platforms: {
            tiktok: data.networks.includes('tiktok'),
            instagram: data.networks.includes('instagram'),
            youtube: data.networks.includes('youtube'),
          },
          min_followers: data.min_followers || undefined,
          min_views: data.min_views || undefined,
          total_prize_pool_cents: data.total_prize_pool_cents,
          currency: data.currency,
          prizes: data.prizes.map((p) => ({
            rank_from: p.rank_start,
            rank_to: p.rank_end,
            amount_cents: p.amount_cents,
          })),
          terms_markdown: data.terms_markdown || undefined,
          terms_url: data.terms_url || undefined,
          brand_id: userId,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || 'Erreur lors de la création du concours');
      }

      const contestId = result.contest_id;
      updateData({ contest_id: contestId });

      // 2. Initier le paiement Stripe
      setIsLoadingPayment(true);
      const paymentResponse = await fetch('/api/payments/brand/fund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contest_id: contestId,
          amount_cents: data.total_prize_pool_cents,
          currency: data.currency,
        }),
      });

      const paymentResult = await paymentResponse.json();

      if (!paymentResponse.ok || !paymentResult.ok) {
        throw new Error(paymentResult.message || 'Erreur lors de la création du paiement');
      }

      // 3. Rediriger vers Stripe Checkout
      if (paymentResult.checkout_url) {
        window.location.href = paymentResult.checkout_url;
      } else {
        throw new Error('URL de paiement non reçue');
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
      setIsCreating(false);
      setIsLoadingPayment(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Paiement</h3>
        <p className="text-sm text-muted-foreground">
          Finalise ton concours en réglant le prize pool. Le concours sera activé automatiquement
          après paiement.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Récapitulatif</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Concours:</span>
            <span className="font-semibold">{data.title}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Prize pool:</span>
            <span className="text-2xl font-semibold">
              {formatCurrency(data.total_prize_pool_cents, data.currency)}
            </span>
          </div>
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold">Total à payer:</span>
              <span className="text-2xl font-bold text-primary">
                {formatCurrency(data.total_prize_pool_cents, data.currency)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <p className="text-sm">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
              <p>Le concours sera créé en brouillon</p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
              <p>Paiement sécurisé via Stripe</p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
              <p>Activation automatique après validation du paiement</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button
          onClick={handleCreateAndPay}
          disabled={isCreating || isLoadingPayment}
          className="flex-1"
          size="lg"
        >
          {isCreating || isLoadingPayment ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {isCreating ? 'Création du concours...' : 'Redirection vers le paiement...'}
            </>
          ) : (
            `Payer ${formatCurrency(data.total_prize_pool_cents, data.currency)}`
          )}
        </Button>
      </div>
    </div>
  );
}

