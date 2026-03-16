'use client';

import { useMemo, useCallback, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getCsrfToken } from '@/lib/csrf-client';
import { WalletBalanceCard } from './wallet-balance-card';
import { EarningsChart } from './earnings-chart';
import { CashoutSlider } from './cashout-slider';
import { TransactionList } from './transaction-list';
import { StripeConnectOnboarding } from './stripe-connect-onboarding';
import { useToastContext } from '@/hooks/use-toast-context';
import type { WalletData } from './wallet-balance';

export interface UltimateCreatorWalletProps {
  wallet: WalletData;
  stripeConnected?: boolean;
}

export function UltimateCreatorWallet({ wallet, stripeConnected = true }: UltimateCreatorWalletProps) {
  const { toast } = useToastContext();
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const onboarding = searchParams.get('onboarding');
    if (onboarding !== 'complete' && onboarding !== 'refresh') return;
    const sync = async () => {
      try {
        await fetch('/api/payments/creator/onboarding/status');
        router.replace('/app/creator/wallet', { scroll: false });
        router.refresh();
      } catch {
        router.replace('/app/creator/wallet', { scroll: false });
      }
    };
    sync();
  }, [searchParams, router]);

  const handleConfigurer = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/payments/creator/onboarding', {
        method: 'POST',
        headers: {
          'x-csrf': getCsrfToken(),
          'content-type': 'application/json',
        },
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erreur');
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error('URL non reçue');
    } catch (e) {
      toast({
        type: 'error',
        title: 'Erreur',
        message: e instanceof Error ? e.message : 'Impossible de lancer la configuration.',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);
  const chartData = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const byDay = new Map<string, number>();
    wallet.winnings.forEach((w) => {
      const d = new Date(w.calculated_at);
      if (d < cutoff) return;
      const key = d.toISOString().slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + w.payout_cents / 100);
    });
    return Array.from(byDay.entries())
      .sort(([a], [b]) => (a > b ? 1 : -1))
      .map(([date, value]) => ({
        date: new Intl.DateTimeFormat('fr-FR', { month: 'short', day: 'numeric' }).format(new Date(date)),
        fullDate: date,
        value,
      }));
  }, [wallet.winnings]);

  const transactions = useMemo(
    () =>
      wallet.winnings.map((w) => ({
        id: w.id,
        contestTitle: w.contest_title,
        payoutCents: w.payout_cents,
        createdAt: w.calculated_at,
        brandAvatarUrl: null as string | null | undefined,
      })),
    [wallet.winnings]
  );

  return (
    <div className="space-y-6">
      {!stripeConnected && (
        <StripeConnectOnboarding onConfigurer={handleConfigurer} />
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <WalletBalanceCard
            balanceCents={wallet.balance_cents}
            currency={wallet.currency}
            stripeConnected={stripeConnected}
            onConfigurer={handleConfigurer}
            configurerLoading={loading}
          >
            <CashoutSlider
              balanceCents={wallet.balance_cents}
              currency={wallet.currency}
              disabled={!stripeConnected}
            />
          </WalletBalanceCard>
        </div>
        <div className="lg:col-span-1">
          <EarningsChart data={chartData} />
        </div>
      </div>

      <TransactionList transactions={transactions} currency={wallet.currency} />
    </div>
  );
}
