'use client';

import { useState } from 'react';
import { useContestWizard } from '@/store/useContestWizard';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/formatters';
import { useCsrfToken } from '@/hooks/use-csrf-token';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

export function Step5Review() {
  const { data, totalPriceCents, platformFeeCents } = useContestWizard();
  const csrfToken = useCsrfToken();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePay = async () => {
    setError(null);

    try {
      if (!csrfToken) {
        throw new Error('Token CSRF manquant. Recharge la page.');
      }

      setIsLoading(true);

      // 1) Créer le concours (brouillon + paramètres)
      const createRes = await fetch('/api/contests/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({
          contest_type: data.contest_type,
          product_details: data.product_details,
          shipping_info: data.shipping_info,
          platform_fee: platformFeeCents,
          title: data.title,
          brief_md: data.description,
          cover_url: data.product_details?.image_url || undefined,
          start_at: data.start_at,
          end_at: data.end_at,
          allowed_platforms: {
            tiktok: data.platforms.includes('tiktok'),
            instagram: data.platforms.includes('instagram'),
            youtube: data.platforms.includes('youtube'),
          },
          total_prize_pool_cents: data.contest_type === 'cash' ? data.prize_amount ?? 0 : 0,
          currency: 'EUR',
          // Les détails fins (répartition, shipping, etc.) seront affinés côté backend plus tard.
        }),
      });

      const createJson = await createRes.json();
      if (!createRes.ok || !createJson.ok) {
        throw new Error(createJson.message || 'Erreur lors de la création du concours');
      }

      const contestId = createJson.contest_id as string | undefined;
      if (!contestId) {
        throw new Error('ID concours manquant dans la réponse serveur');
      }

      // 2) Initier le paiement Stripe
      const paymentRes = await fetch('/api/payments/brand/fund', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({ contest_id: contestId }),
      });

      const paymentJson = await paymentRes.json();
      if (!paymentRes.ok || !paymentJson.ok) {
        throw new Error(paymentJson.message || 'Erreur lors de la création du paiement');
      }

      if (!paymentJson.checkout_url) {
        throw new Error('URL de paiement non reçue');
      }

      window.location.href = paymentJson.checkout_url as string;
    } catch (e) {
      setIsLoading(false);
      setError(e instanceof Error ? e.message : 'Une erreur est survenue');
    }
  };

  const subtotal = totalPriceCents;
  const fees = platformFeeCents;
  const total = subtotal + fees;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Vérifie et paie ton concours</h2>
        <p className="text-sm text-muted-foreground">
          Un dernier coup d’œil avant de lancer la machine. Tu pourras toujours affiner certains
          réglages ensuite.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardContent className="pt-5 space-y-3">
            <p className="text-sm font-medium mb-1">Ticket de caisse</p>

            <LineItem
              label="Prize pool"
              value={formatCurrency(subtotal, 'EUR')}
              highlight
            />
            <LineItem
              label="Frais plateforme"
              value={formatCurrency(fees, 'EUR')}
              small
            />

            <div className="border-t border-dashed my-2" />

            <LineItem
              label="Total à payer"
              value={formatCurrency(total, 'EUR')}
              strong
            />

            <p className="text-[11px] text-muted-foreground mt-3">
              Le paiement est sécurisé via Stripe. Le concours sera activé automatiquement après
              confirmation.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-muted/40">
          <CardContent className="pt-5 space-y-3">
            <p className="text-sm font-medium mb-1">Récapitulatif express</p>
            <SummaryRow label="Titre" value={data.title || '—'} />
            <SummaryRow
              label="Type"
              value={data.contest_type === 'cash' ? 'Cashprize' : 'Produit'}
            />
            <SummaryRow label="Plateformes" value={data.platforms.join(', ').toUpperCase()} />
          </CardContent>
        </Card>
      </div>

      {error && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-4 flex flex-col gap-3 text-sm">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary mt-[2px]" />
            <p>
              Ton concours sera créé en statut <span className="font-semibold">draft</span> puis
              automatiquement activé après le paiement.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary mt-[2px]" />
            <p>Paiement traité par Stripe, aucun moyen de paiement n’est stocké chez ClipRace.</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          size="lg"
          className="min-w-[180px]"
          onClick={handlePay}
          loading={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Redirection en cours...
            </>
          ) : (
            `Payer ${formatCurrency(total, 'EUR')}`
          )}
        </Button>
      </div>
    </div>
  );
}

function LineItem({
  label,
  value,
  small,
  highlight,
  strong,
}: {
  label: string;
  value: string;
  small?: boolean;
  highlight?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span
        className={[
          'text-muted-foreground',
          small ? 'text-xs' : '',
          highlight ? 'text-foreground' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {label}
      </span>
      <span
        className={[
          'font-medium',
          strong ? 'text-base font-semibold text-primary' : '',
          highlight ? 'text-foreground' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {value}
      </span>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-sm flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right truncate max-w-[200px]">{value}</span>
    </div>
  );
}

