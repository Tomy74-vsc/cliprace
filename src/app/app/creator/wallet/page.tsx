/*
Page Wallet - Ultimate Creator Wallet (Revolut/N26 style).
Bento: Carte hero + Graphique + Liste transactions.
*/
import { getSupabaseSSR } from "@/lib/supabase/ssr";
import { getSession } from "@/lib/auth";
import { EmptyState } from "@/components/creator/empty-state";
import { TrackOnView } from "@/components/analytics/track-once";
import { UltimateCreatorWallet } from "@/components/wallet/ultimate-creator-wallet";
import type { WalletData } from "@/components/wallet/wallet-balance";

async function getWalletData(userId: string): Promise<{ wallet?: WalletData; error?: string }> {
  try {
    const supabase = await getSupabaseSSR();

    const { data: winnings, error: winError } = await supabase
      .from("contest_winnings")
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
      .eq("creator_id", userId)
      .order("calculated_at", { ascending: false });

    if (winError) throw winError;

    const { data: cashouts, error: cashoutError } = await supabase
      .from("cashouts")
      .select("id, amount_cents, status, requested_at, processed_at")
      .eq("creator_id", userId)
      .order("requested_at", { ascending: false });

    if (cashoutError) throw cashoutError;

    const unpaidWinnings = (winnings || [])
      .filter((w) => !w.paid_at)
      .reduce((sum, w) => sum + w.payout_cents, 0);

    const activeCashouts =
      (cashouts || [])
        .filter((c) => ["requested", "processing"].includes(c.status))
        .reduce((sum, c) => sum + c.amount_cents, 0) || 0;

    const balance_cents = Math.max(0, unpaidWinnings - activeCashouts);
    const total_earnings_cents = (winnings || []).reduce(
      (sum, w) => sum + w.payout_cents,
      0,
    );

    return {
      wallet: {
        balance_cents,
        total_earnings_cents,
        withdrawn_cents: (cashouts || [])
          .filter((c) => c.status === "paid")
          .reduce((sum, c) => sum + c.amount_cents, 0),
        pending_cents: unpaidWinnings,
        currency: "EUR",
        average_processing_days: null,
        winnings: (winnings || []).map((w) => {
          const contestRel = w.contest as unknown;
          const contestTitle =
            (Array.isArray(contestRel)
              ? (contestRel[0] as { title?: string } | undefined)?.title
              : (contestRel as { title?: string } | null | undefined)?.title) || "Concours inconnu";
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
          status: c.status as WalletData["cashouts"][number]["status"],
          requested_at: c.requested_at,
          processed_at: c.processed_at,
        })),
      },
    };
  } catch (error) {
    console.error("Wallet load error", error);
    return {
      error:
        "Impossible de charger ton portefeuille. Réessaie plus tard ou contacte le support.",
    };
  }
}

function WalletSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-[200px] rounded-3xl bg-zinc-800/50" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2" />
        <div className="h-[220px] rounded-2xl bg-zinc-800/50" />
      </div>
      <div className="h-[240px] rounded-2xl bg-zinc-800/50" />
    </div>
  );
}

async function getStripeConnectStatus(userId: string): Promise<boolean> {
  try {
    const supabase = await getSupabaseSSR();
    const { data, error } = await supabase
      .from("profiles")
      .select("stripe_account_id, stripe_details_submitted")
      .eq("id", userId)
      .single();
    if (error) return false;
    const row = data as { stripe_account_id?: string | null; stripe_details_submitted?: boolean } | null;
    return Boolean(row?.stripe_account_id && row?.stripe_details_submitted);
  } catch {
    return false;
  }
}

export default async function WalletPage() {
  const { user } = await getSession();
  if (!user) return null;

  const [walletResult, stripeConnected] = await Promise.all([
    getWalletData(user.id),
    getStripeConnectStatus(user.id),
  ]);
  const { wallet, error } = walletResult;

  if (error) {
    return (
      <main className="min-h-screen bg-zinc-950 px-4 py-8 text-white">
        <WalletSkeleton />
        <EmptyState
          title="Erreur de chargement"
          description="Impossible de charger ton portefeuille. Réessaie plus tard ou contacte le support si le problème persiste."
          action={{ label: "Réessayer", href: "/app/creator/wallet", variant: "secondary" }}
        />
      </main>
    );
  }

  if (!wallet) {
    return (
      <main className="min-h-screen bg-zinc-950 px-4 py-8">
        <WalletSkeleton />
      </main>
    );
  }

  const hasAnyData = wallet.winnings.length > 0 || wallet.cashouts.length > 0;

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-white">
      <TrackOnView
        event="view_wallet"
        payload={{
          balance_cents: wallet.balance_cents,
          total_earnings_cents: wallet.total_earnings_cents,
          withdrawn_cents: wallet.withdrawn_cents,
          pending_cents: wallet.pending_cents,
        }}
      />
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
            Mon portefeuille
          </h1>
          <p className="mt-1 text-sm text-white/60">
            Gère tes gains et demande des retraits.
          </p>
        </div>

        {!hasAnyData ? (
          <EmptyState
            title="Aucun gain pour l'instant"
            description="Participe à des concours pour débloquer des récompenses."
            action={{ label: "Découvrir les concours", href: "/app/creator/contests" }}
          />
        ) : (
          <UltimateCreatorWallet wallet={wallet} stripeConnected={stripeConnected} />
        )}
      </div>
    </main>
  );
}
