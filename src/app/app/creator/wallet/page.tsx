/*
Page Wallet — recap gains + cashouts, empty state si aucun gain.
*/
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { getSession } from '@/lib/auth';
import { WalletBalance, type WalletData } from '@/components/wallet/wallet-balance';
import { EmptyState } from '@/components/creator/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/creator/skeletons';

async function getWalletData(userId: string): Promise<WalletData> {
  const supabase = getSupabaseSSR();

  const { data: winnings } = await supabase
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
    `
    )
    .eq('creator_id', userId)
    .order('calculated_at', { ascending: false });

  const { data: cashouts } = await supabase
    .from('cashouts')
    .select('id, amount_cents, status, created_at, paid_at')
    .eq('creator_id', userId)
    .order('created_at', { ascending: false });

  const unpaidWinnings = (winnings || []).filter((w) => !w.paid_at).reduce((sum, w) => sum + w.payout_cents, 0);
  const activeCashouts = (cashouts || [])
    .filter((c) => ['requested', 'processing', 'paid'].includes(c.status))
    .reduce((sum, c) => sum + c.amount_cents, 0);
  const balance_cents = Math.max(0, unpaidWinnings - activeCashouts);

  return {
    balance_cents,
    currency: 'EUR',
    winnings: (winnings || []).map((w) => ({
      id: w.id,
      contest_id: w.contest_id,
      contest_title: (w.contest as { title: string })?.title || 'Concours inconnu',
      rank: w.rank,
      payout_cents: w.payout_cents,
      payout_percentage: w.payout_percentage,
      calculated_at: w.calculated_at,
      paid_at: w.paid_at,
      cashout_id: w.cashout_id,
    })),
    cashouts: (cashouts || []).map((c) => ({
      id: c.id,
      amount_cents: c.amount_cents,
      status: c.status as 'requested' | 'processing' | 'paid' | 'failed' | 'canceled',
      created_at: c.created_at,
      paid_at: c.paid_at,
    })),
  };
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

  const wallet = await getWalletData(user.id);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <div>
        <h1 className="display-2 mb-2">Mon portefeuille</h1>
        <p className="text-muted-foreground">Gérez vos gains et demandez des retraits</p>
      </div>

      {!wallet.winnings.length && !wallet.cashouts.length ? (
        <EmptyState
          title="Aucun gain pour l’instant"
          description="Participe à des concours pour débloquer des récompenses."
          action={{ label: 'Voir les concours', href: '/app/creator/contests' }}
        />
      ) : (
        <WalletBalance wallet={wallet} />
      )}
    </main>
  );
}
