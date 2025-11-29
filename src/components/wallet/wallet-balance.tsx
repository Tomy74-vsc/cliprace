/*
Component: WalletBalance
Affiche solde, graphique gains, historique gains et cashouts avec confirmations.
*/
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Info, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useToastContext } from '@/hooks/use-toast-context';
import { useCsrfToken } from '@/hooks/use-csrf-token';
import { track } from '@/lib/analytics';

export interface WalletData {
  balance_cents: number;
  total_earnings_cents: number;
  withdrawn_cents: number;
  pending_cents: number;
  currency: string;
  average_processing_days?: number | null;
  winnings: {
    id: string;
    contest_id: string;
    contest_title: string;
    rank: number;
    payout_cents: number;
    payout_percentage: number | null;
    calculated_at: string;
    paid_at: string | null;
    cashout_id: string | null;
  }[];
  cashouts: {
    id: string;
    amount_cents: number;
    status: 'requested' | 'processing' | 'paid' | 'failed' | 'canceled';
    requested_at: string;
    processed_at: string | null;
  }[];
}

interface WalletBalanceProps {
  wallet: WalletData;
}

const CASHOUT_STATUS_LABELS: Record<
  WalletData['cashouts'][number]['status'],
  { label: string; variant: 'default' | 'success' | 'warning' | 'danger' }
> = {
  requested: { label: 'Demande', variant: 'default' },
  processing: { label: 'En cours', variant: 'warning' },
  paid: { label: 'Payé', variant: 'success' },
  failed: { label: 'Échec', variant: 'danger' },
  canceled: { label: 'Annulé', variant: 'default' },
};

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency || 'EUR',
    minimumFractionDigits: 0,
  }).format(amount / 100);
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function WalletBalance({ wallet }: WalletBalanceProps) {
  const [isRequestingCashout, setIsRequestingCashout] = useState(false);
  const [openConfirm, setOpenConfirm] = useState(false);
  const { toast } = useToastContext();
  const router = useRouter();
  const csrfToken = useCsrfToken();

  const chartData = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const grouped = new Map<string, number>();
    wallet.winnings.forEach((w) => {
      const d = new Date(w.calculated_at);
      if (d < cutoff) return;
      const key = d.toISOString().slice(0, 10);
      grouped.set(key, (grouped.get(key) || 0) + w.payout_cents / 100);
    });
    return Array.from(grouped.entries())
      .sort(([a], [b]) => (a > b ? 1 : -1))
      .map(([date, value]) => ({
        date: new Intl.DateTimeFormat('fr-FR', { month: 'short', day: 'numeric' }).format(new Date(date)),
        value,
      }));
  }, [wallet.winnings]);

  const handleCashout = async () => {
    if (wallet.balance_cents <= 0) {
      toast({ type: 'error', title: 'Erreur', message: "Vous n'avez pas de solde disponible." });
      return;
    }
    setOpenConfirm(false);
    track('start_cashout', { amount_cents: wallet.balance_cents });
    setIsRequestingCashout(true);
    try {
      const response = await fetch('/api/payments/creator/cashout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf': csrfToken || '',
        },
        body: JSON.stringify({ amount_cents: wallet.balance_cents }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Erreur lors de la demande de retrait');
      toast({
        type: 'success',
        title: 'Demande de retrait créée',
        message: 'Votre demande a bien été enregistrée.',
      });
      router.refresh();
    } catch (error) {
      toast({
        type: 'error',
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Une erreur est survenue',
      });
    } finally {
      setIsRequestingCashout(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">En attente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {formatCurrency(wallet.pending_cents, wallet.currency)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Gains calculés, pas encore versés sur ton solde disponible.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Solde disponible</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {formatCurrency(wallet.balance_cents, wallet.currency)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Montant que tu peux demander en retrait (hors retraits déjà en cours).
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Déjà retiré</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {formatCurrency(wallet.withdrawn_cents, wallet.currency)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total versé via les retraits validés.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
        <CardHeader>
          <CardTitle>Solde disponible</CardTitle>
          <CardDescription>Montant que vous pouvez retirer.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold text-foreground mb-4">
            {formatCurrency(wallet.balance_cents, wallet.currency)}
          </div>
          <Dialog open={openConfirm} onOpenChange={setOpenConfirm}>
            <DialogTrigger asChild>
              <Button
                variant="primary"
                disabled={isRequestingCashout || wallet.balance_cents <= 0}
                className="w-full sm:w-auto"
              >
                {isRequestingCashout ? 'Traitement...' : 'Demander un retrait'}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirmer le retrait</DialogTitle>
                <DialogDescription>
                  Montant : {formatCurrency(wallet.balance_cents, wallet.currency)}.{' '}
                  {wallet.average_processing_days
                    ? `Délai estimé : ~${wallet.average_processing_days} jours ouvrés.`
                    : 'Traitement dès réception.'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  Vérification possible pour sécuriser le paiement.
                </div>
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-primary" />
                  Assure-toi que tes informations de paiement sont à jour.
                </div>
              </div>
              <DialogFooter className="flex justify-end gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setOpenConfirm(false)}
                  disabled={isRequestingCashout}
                >
                  Annuler
                </Button>
                <Button onClick={handleCashout} disabled={isRequestingCashout}>
                  Confirmer
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          {wallet.balance_cents <= 0 && (
            <p className="mt-2 text-sm text-muted-foreground">
              Vous n&apos;avez pas de solde disponible pour le moment.
            </p>
          )}
          {wallet.average_processing_days ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Délai moyen observé : ~{wallet.average_processing_days} jours ouvrés.
            </p>
          ) : null}
          <p className="mt-1 text-xs text-muted-foreground">
            Ce solde tient déjà compte des retraits en cours (demandés ou en traitement).
          </p>
        </CardContent>
      </Card>

      {wallet.winnings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Gains 30 derniers jours</CardTitle>
            <CardDescription>Historique de vos gains récents.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-48">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary))"
                      fillOpacity={0.15}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground">Pas encore de données de gains.</p>
              )}
            </div>
            <div className="space-y-4">
              {wallet.winnings.map((winning) => (
                <div
                  key={winning.id}
                  className="flex items-center justify-between border-b border-border pb-4 last:border-0 last:pb-0"
                >
                  <div className="flex-1">
                    <div className="font-medium text-foreground">{winning.contest_title}</div>
                    <div className="text-sm text-muted-foreground">
                      Rang #{winning.rank} · {formatDate(winning.calculated_at)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-foreground">
                      {formatCurrency(winning.payout_cents, wallet.currency)}
                    </div>
                    {winning.paid_at ? (
                      <Badge variant="success" className="mt-1">
                        Payé
                      </Badge>
                    ) : (
                      <Badge variant="default" className="mt-1">
                        En attente
                      </Badge>
                    )}
                    <Button asChild variant="ghost" size="sm" className="px-0 text-xs text-primary">
                      <a href={`/app/creator/contests/${winning.contest_id}`} className="text-primary">
                        Voir concours
                      </a>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {wallet.cashouts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Retraits ({wallet.cashouts.length})</CardTitle>
            <CardDescription>Historique de vos demandes de retrait.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {wallet.cashouts.map((cashout) => {
                const statusInfo = CASHOUT_STATUS_LABELS[cashout.status];
                return (
                  <div
                    key={cashout.id}
                    className="flex items-center justify-between border-b border-border pb-4 last:border-0 last:pb-0"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-foreground">
                        {formatCurrency(cashout.amount_cents, wallet.currency)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Demande le {formatDate(cashout.requested_at)}
                        {cashout.processed_at ? ` · Traitée le ${formatDate(cashout.processed_at)}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={statusInfo.variant}
                        className={cashout.status === 'processing' ? 'animate-pulse' : ''}
                      >
                        {statusInfo.label}
                      </Badge>
                      {cashout.status === 'failed' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            toast({
                              type: 'info',
                              title: 'Contact support',
                              message:
                                'Merci de contacter le support si ce retrait reste en échec plusieurs jours.',
                            })
                          }
                        >
                          Aide
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {wallet.winnings.length === 0 && wallet.cashouts.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Aucun gain ou retrait pour le moment.</p>
            <Button asChild className="mt-3">
              <a href="/app/creator/contests">Découvrir les concours</a>
            </Button>
          </CardContent>
        </Card>
      )}

      <Accordion type="single" collapsible>
        <AccordionItem value="how">
          <AccordionTrigger>Comment ça marche ?</AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-2">
            <p>1. Les gains sont calculés après clôture des concours et apparaissent d&apos;abord en attente.</p>
            <p>
              2. Les retraits peuvent prendre {wallet.average_processing_days ?? 'quelques'} jours ouvrés, selon ton
              moyen de paiement.
            </p>
            <p>3. Vérifie tes informations de paiement avant de demander un retrait.</p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
