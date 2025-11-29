/*
Page Wallet - récap gains + retraits, empty state si aucun gain.
*/
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { getSession } from '@/lib/auth';
import { WalletBalance, type WalletData } from '@/components/wallet/wallet-balance';
import { EmptyState } from '@/components/creator/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/creator/skeletons';
import { TrackOnView } from '@/components/analytics/track-once';

async function getWalletData(userId: string): Promise<{ wallet?: WalletData; error?: string }> {
  try {
    const supabase = await getSupabaseSSR();

    const { data: winnings, error: winError } = await supabase
      .from('contest_winnings')
      .select(
        `
        id,
        contest_id,
        rank,
        payout_cents,
        payout_percentage,
        calculated_at,
        paid_at,
        cashout_id,
        contest:contest_id ( title )
      `,
      )
      .eq('creator_id', userId)
      .order('calculated_at', { ascending: false });

    if (winError) throw winError;

    const { data: cashouts, error: cashoutError } = await supabase
      .from('cashouts')
      .select('id, amount_cents, status, requested_at, processed_at')
      .eq('creator_id', userId)
      .order('requested_at', { ascending: false });

    if (cashoutError) throw cashoutError;

    const unpaidWinnings = (winnings || [])
      .filter((w) => !w.paid_at)
      .reduce((sum, w) => sum + w.payout_cents, 0);

    const activeCashouts =
      (cashouts || [])
        .filter((c) => ['requested', 'processing'].includes(c.status))
        .reduce((sum, c) => sum + c.amount_cents, 0) || 0;

    const balance_cents = Math.max(0, unpaidWinnings - activeCashouts);
    const total_earnings_cents = (winnings || []).reduce(
      (sum, w) => sum + w.payout_cents,
      0,
    );
    const withdrawn_cents = (cashouts || [])
      .filter((c) => c.status === 'paid')
      .reduce((sum, c) => sum + c.amount_cents, 0);

    const delays: number[] = (cashouts || [])
      .filter((c) => c.processed_at)
      .map(
        (c) =>
          (new Date(c.processed_at as string).getTime() -
            new Date(c.requested_at).getTime()) /
          (1000 * 60 * 60 * 24),
      );

    const average_processing_days = delays.length
      ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length)
      : null;

    return {
      wallet: {
        balance_cents,
        total_earnings_cents,
        withdrawn_cents,
        pending_cents: unpaidWinnings,
        currency: 'EUR',
        average_processing_days,
        winnings: (winnings || []).map((w) => {
          const contestRel = w.contest as unknown;
          const contestTitle =
            (Array.isArray(contestRel)
              ? (contestRel[0] as { title?: string } | undefined)?.title
              : (contestRel as { title?: string } | null | undefined)?.title) || 'Concours inconnu';

          return {
            id: w.id,
            contest_id: w.contest_id,
            contest_title: contestTitle,
            rank: w.rank,
            payout_cents: w.payout_cents,
            payout_percentage: w.payout_percentage,
            calculated_at: w.calculated_at,
            paid_at: w.paid_at,
            cashout_id: w.cashout_id,
          };
        }),
        cashouts: (cashouts || []).map((c) => ({
          id: c.id,
          amount_cents: c.amount_cents,
          status: c.status as WalletData['cashouts'][number]['status'],
          requested_at: c.requested_at,
          processed_at: c.processed_at,
        })),
      },
    };
  } catch (error) {
    console.error('Wallet load error', error);
    return {
      error:
        'Impossible de charger ton portefeuille. Réessaie plus tard ou contacte le support.',
    };
  }
}

function WalletSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="py-8 space-y-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-10 w-32" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="py-8 space-y-3">
          <Skeleton className="h-5 w-32" />
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default async function WalletPage() {
  const { user } = await getSession();
  if (!user) return null;

  const { wallet, error } = await getWalletData(user.id);

  if (error) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <WalletSkeleton />
        <EmptyState
          title="Erreur de chargement"
          description="Impossible de charger ton portefeuille. Réessaie plus tard ou contacte le support si le problème persiste."
          action={{ label: 'Réessayer', href: '/app/creator/wallet', variant: 'secondary' }}
        />
      </main>
    );
  }

  if (!wallet) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <WalletSkeleton />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 space-y-6 animate-fadeUpSoft">
      <TrackOnView
        event="view_wallet"
        payload={{
          balance_cents: wallet.balance_cents,
          total_earnings_cents: wallet.total_earnings_cents,
          withdrawn_cents: wallet.withdrawn_cents,
          pending_cents: wallet.pending_cents,
        }}
      />
      <div>
        <h1 className="display-2 mb-2">Mon portefeuille</h1>
        <p className="text-muted-foreground">Gère tes gains et demande des retraits.</p>
      </div>

      {!wallet.winnings.length && !wallet.cashouts.length ? (
        <EmptyState
          title="Aucun gain pour l'instant"
          description="Participe à des concours pour débloquer des récompenses."
          action={{ label: 'Découvrir les concours', href: '/app/creator/contests' }}
        />
      ) : (
        <WalletBalance wallet={wallet} />
      )}
    </main>
  );
}
