'use client';

import { useState } from 'react';
import { useContestWizard } from '@/store/useContestWizard';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/formatters';
import { useCsrfToken } from '@/hooks/use-csrf-token';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

export function Step5Review() {
  const { data, totalPriceCents, platformFeeCents, editContestId, reset } = useContestWizard();
  const csrfToken = useCsrfToken();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEditMode = !!editContestId;

  const buildContestPayload = () => ({
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
  });

  /** Edit mode: update the existing draft without re-payment */
  const handleSaveDraft = async () => {
    setError(null);
    try {
      if (!csrfToken) throw new Error('Token CSRF manquant. Recharge la page.');
      setIsLoading(true);

      const res = await fetch(`/api/contests/${editContestId}/update`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify(buildContestPayload()),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.message || 'Erreur lors de la mise \u00e0 jour du concours');
      }

      // Reset wizard store and redirect to contest detail
      reset();
      window.location.href = `/app/brand/contests/${editContestId}`;
    } catch (e) {
      setIsLoading(false);
      setError(e instanceof Error ? e.message : 'Une erreur est survenue');
    }
  };

  /** Create mode: create contest draft + initiate Stripe payment */
  const handlePay = async () => {
    setError(null);
    try {
      if (!csrfToken) throw new Error('Token CSRF manquant. Recharge la page.');
      setIsLoading(true);

      // 1) Create contest draft
      const createRes = await fetch('/api/contests/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify(buildContestPayload()),
      });

      const createJson = await createRes.json();
      if (!createRes.ok || !createJson.ok) {
        throw new Error(createJson.message || 'Erreur lors de la cr\u00e9ation du concours');
      }

      const contestId = createJson.contest_id as string | undefined;
      if (!contestId) throw new Error('ID concours manquant dans la r\u00e9ponse serveur');

      // 2) Initiate Stripe payment
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
        throw new Error(paymentJson.message || 'Erreur lors de la cr\u00e9ation du paiement');
      }

      if (!paymentJson.checkout_url) throw new Error('URL de paiement non re\u00e7ue');

      reset();
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
        <h2 className="text-2xl font-semibold tracking-tight">
          {isEditMode ? 'V\u00e9rifie et enregistre les modifications' : 'V\u00e9rifie et paie ton concours'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isEditMode
            ? 'Passe en revue les modifications avant de sauvegarder le brouillon.'
            : 'Un dernier coup d\u2019\u0153il avant de lancer la machine. Tu pourras toujours affiner certains r\u00e9glages ensuite.'}
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
              label={isEditMode ? 'Total' : 'Total \u00e0 payer'}
              value={formatCurrency(total, 'EUR')}
              strong
            />

            <p className="text-[11px] text-muted-foreground mt-3">
              {isEditMode
                ? 'Le paiement sera initi\u00e9 apr\u00e8s validation du brouillon.'
                : 'Le paiement est s\u00e9curis\u00e9 via Stripe. Le concours sera activ\u00e9 automatiquement apr\u00e8s confirmation.'}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-muted/40">
          <CardContent className="pt-5 space-y-3">
            <p className="text-sm font-medium mb-1">R\u00e9capitulatif express</p>
            <SummaryRow label="Titre" value={data.title || '\u2014'} />
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
          {isEditMode ? (
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary mt-[2px]" />
              <p>
                Le brouillon sera mis \u00e0 jour. Tu pourras initier le paiement apr\u00e8s
                avoir v\u00e9rifi\u00e9 tous les d\u00e9tails.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary mt-[2px]" />
                <p>
                  Ton concours sera cr\u00e9\u00e9 en statut <span className="font-semibold">draft</span> puis
                  automatiquement activ\u00e9 apr\u00e8s le paiement.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary mt-[2px]" />
                <p>Paiement trait\u00e9 par Stripe, aucun moyen de paiement n&apos;est stock\u00e9 chez ClipRace.</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        {isEditMode ? (
          <Button
            size="lg"
            className="min-w-[180px]"
            onClick={handleSaveDraft}
            loading={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enregistrement...
              </>
            ) : (
              'Enregistrer le brouillon'
            )}
          </Button>
        ) : (
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
        )}
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
