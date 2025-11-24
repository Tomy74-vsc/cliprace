/*
Component: WalletBalance
Affiche solde, graphique gains, historique gains et cashouts avec badges statut.
*/
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToastContext } from '@/hooks/use-toast-context';
import { useCsrfToken } from '@/hooks/use-csrf-token';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

export interface WalletData {
  balance_cents: number;
  currency: string;
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
    created_at: string;
    paid_at: string | null;
  }[];
}

interface WalletBalanceProps {
  wallet: WalletData;
}

const CASHOUT_STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' }> = {
  requested: { label: 'Demandé', variant: 'default' },
  processing: { label: 'En cours', variant: 'warning' },
  paid: { label: 'Payé', variant: 'success' },
  failed: { label: 'Échoué', variant: 'danger' },
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
  const { toast } = useToastContext();
  const router = useRouter();
  const csrfToken = useCsrfToken();

  const chartData = useMemo(() => {
    const data = wallet.winnings.map((w) => ({
      date: new Intl.DateTimeFormat('fr-FR', { month: 'short', day: 'numeric' }).format(new Date(w.calculated_at)),
      value: w.payout_cents / 100,
    }));
    return data.slice(0, 30);
  }, [wallet.winnings]);

  const handleCashout = async () => {
    if (wallet.balance_cents <= 0) {
      toast({ type: 'error', title: 'Erreur', message: "Vous n'avez pas de solde disponible" });
      return;
    }
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
        title: 'Demande de retrait créée !',
        message: 'Votre demande de retrait a été enregistrée avec succès.',
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
      <Card className="bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
        <CardHeader>
          <CardTitle>Solde disponible</CardTitle>
          <CardDescription>Montant que vous pouvez retirer</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold text-foreground mb-4">
            {formatCurrency(wallet.balance_cents, wallet.currency)}
          </div>
          <Button
            variant="primary"
            onClick={handleCashout}
            disabled={isRequestingCashout || wallet.balance_cents <= 0}
            className="w-full sm:w-auto"
          >
            {isRequestingCashout ? 'Traitement...' : 'Demander un retrait'}
          </Button>
          {wallet.balance_cents <= 0 && (
            <p className="mt-2 text-sm text-muted-foreground">Vous n'avez pas de solde disponible pour le moment.</p>
          )}
        </CardContent>
      </Card>

      {wallet.winnings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Gains ({wallet.winnings.length})</CardTitle>
            <CardDescription>Historique de vos gains</CardDescription>
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
                    <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} />
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
            <CardDescription>Historique de vos demandes de retrait</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {wallet.cashouts.map((cashout) => {
                const statusInfo = CASHOUT_STATUS_LABELS[cashout.status] || { label: cashout.status, variant: 'default' as const };
                return (
                  <div
                    key={cashout.id}
                    className="flex items-center justify-between border-b border-border pb-4 last:border-0 last:pb-0"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-foreground">{formatCurrency(cashout.amount_cents, wallet.currency)}</div>
                      <div className="text-sm text-muted-foreground">{formatDate(cashout.created_at)}</div>
                    </div>
                    <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
