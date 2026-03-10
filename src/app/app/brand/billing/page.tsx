import type { ReactNode } from 'react';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { BrandEmptyState } from '@/components/brand/empty-state-enhanced';
import { TrackOnView } from '@/components/analytics/track-once';
import { StripePortalButton } from '@/components/brand/stripe-portal-button';
import { GlassCard, StatusBadge } from '@/components/brand-ui';
import {
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';

export const revalidate = 60;

type PaymentRowData = {
  id: string;
  contest_id: string;
  contest_title: string;
  amount_cents: number;
  currency: string;
  status: string;
  stripe_payment_intent_id: string | null;
  stripe_customer_id: string | null;
  created_at: string;
};

type BillingStats = {
  total_paid_cents: number;
  pending_cents: number;
  pending_count: number;
  processing_cents: number;
  processing_count: number;
};

type BillingData = {
  payments: PaymentRowData[];
  stats: BillingStats;
  canOpenPortal: boolean;
  portalHint: string;
  error: string | null;
};

export default async function BrandBillingPage() {
  const { user } = await getSession();
  if (!user) return null;

  const { payments, stats, canOpenPortal, portalHint, error } = await fetchBillingData(user.id);

  if (error) {
    return (
      <main className="space-y-6">
        <BrandEmptyState
          type="default"
          title="Erreur de chargement"
          description="Impossible de charger la facturation. Reessayez dans quelques minutes."
          action={{ label: 'Recharger', href: '/app/brand/billing', variant: 'secondary' }}
        />
      </main>
    );
  }

  return (
    <main className="space-y-8">
      <TrackOnView event="view_brand_billing" payload={{ total: payments.length }} />

      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Facturation & Paiements</h1>
        <p className="text-[var(--text-3)]">
          Gere tes moyens de paiement, tes factures PDF et ton historique en toute securite.
        </p>
      </header>

      <GlassCard className="p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border-1)]">
          <div className="flex items-start gap-3">
            <div className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 p-2 text-[var(--accent)]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-[var(--text-1)]">Portail Stripe securise</h2>
              <p className="text-xs text-[var(--text-3)]">
                Gere tes moyens de paiement, telecharge tes factures PDF et mets a jour tes informations fiscales
                directement via notre partenaire Stripe.
              </p>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <StripePortalButton enabled={canOpenPortal} disabledMessage={portalHint} />
          <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--text-3)]">
            <span className="inline-flex items-center gap-1">
              <CreditCard className="h-3.5 w-3.5" />
              Cartes et moyens de paiement
            </span>
            <span className="inline-flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" />
              Factures PDF
            </span>
            <span className="inline-flex items-center gap-1">
              <ExternalLink className="h-3.5 w-3.5" />
              Session Stripe chiffree
            </span>
          </div>
        </div>
      </GlassCard>

      <section>
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-[var(--r3)] border border-[var(--border-1)] bg-[var(--surface-1)]/80 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-3)]">
                  Total paye
                </p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--text-1)]">
                  {formatCurrency(stats.total_paid_cents, 'EUR')}
                </p>
                <p className="mt-1 text-xs text-[var(--text-3)]">Paiements confirmes</p>
              </div>
              <div className="shrink-0 rounded-full bg-[var(--surface-2)] p-2 text-[var(--text-2)]">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
          </div>
          <div className="rounded-[var(--r3)] border border-[var(--border-1)] bg-[var(--surface-1)]/80 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-3)]">
                  En attente
                </p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--text-1)]">
                  {formatCurrency(stats.pending_cents, 'EUR')}
                </p>
                <p className="mt-1 text-xs text-[var(--text-3)]">
                  {`${stats.pending_count} paiement${stats.pending_count > 1 ? 's' : ''}`}
                </p>
              </div>
              <div className="shrink-0 rounded-full bg-[var(--surface-2)] p-2 text-[var(--text-2)]">
                <Clock className="h-4 w-4" />
              </div>
            </div>
          </div>
          <div className="rounded-[var(--r3)] border border-[var(--border-1)] bg-[var(--surface-1)]/80 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-3)]">
                  En traitement
                </p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--text-1)]">
                  {formatCurrency(stats.processing_cents, 'EUR')}
                </p>
                <p className="mt-1 text-xs text-[var(--text-3)]">
                  {`${stats.processing_count} paiement${stats.processing_count > 1 ? 's' : ''}`}
                </p>
              </div>
              <div className="shrink-0 rounded-full bg-[var(--surface-2)] p-2 text-[var(--text-2)]">
                <RefreshCw className="h-4 w-4" />
              </div>
            </div>
          </div>
          <div className="rounded-[var(--r3)] border border-[var(--border-1)] bg-[var(--surface-1)]/80 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-3)]">
                  Transactions
                </p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--text-1)]">
                  {String(payments.length)}
                </p>
                <p className="mt-1 text-xs text-[var(--text-3)]">Historique interne</p>
              </div>
              <div className="shrink-0 rounded-full bg-[var(--surface-2)] p-2 text-[var(--text-2)]">
                <CreditCard className="h-4 w-4" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {payments.length === 0 ? (
        <BrandEmptyState
          type="no-payments"
          title="Aucun paiement pour le moment"
          description="Effectue ton premier paiement de campagne pour activer la facturation complete."
          action={{
            label: 'Creer une campagne',
            href: '/app/brand/contests/new',
            variant: 'primary',
          }}
        />
      ) : (
        <GlassCard className="p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border-1)]">
            <h2 className="text-sm font-semibold text-[var(--text-1)]">
              Historique interne des paiements
            </h2>
          </div>
          <div className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-[var(--border-1)] bg-[var(--surface-2)]/60">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Date</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Concours</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Montant</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Statut</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <PaymentTableRow key={payment.id} payment={payment} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </GlassCard>
      )}
    </main>
  );
}

function PaymentTableRow({ payment }: { payment: PaymentRowData }) {
  const needsPayment = payment.status === 'requires_payment' || payment.status === 'processing';
  const isPaid = payment.status === 'succeeded';

  return (
    <tr className="border-b border-[var(--border-1)]/60 hover:bg-[var(--surface-2)]/40 transition-colors">
      <td className="px-4 py-3 text-sm text-[var(--text-3)]">{formatDate(payment.created_at)}</td>
      <td className="px-4 py-3">
        <Link
          href={`/app/brand/contests/${payment.contest_id}`}
          className="font-medium text-foreground hover:text-primary transition-colors"
        >
          {payment.contest_title}
        </Link>
      </td>
      <td className="px-4 py-3 font-semibold">{formatCurrency(payment.amount_cents, payment.currency)}</td>
      <td className="px-4 py-3">
        <PaymentStatusBadge status={payment.status} />
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {needsPayment ? (
            <Link
              href={`/app/brand/contests/${payment.contest_id}`}
              className="inline-flex items-center gap-2 rounded-[var(--r2)] border border-[var(--accent)]/30 bg-[var(--accent)]/8 px-3 py-1.5 text-xs font-medium text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              Regler
            </Link>
          ) : null}

          {isPaid && payment.stripe_payment_intent_id ? (
            <a
              href={`https://dashboard.stripe.com/payments/${payment.stripe_payment_intent_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-[var(--r2)] border border-[var(--border-1)] px-3 py-1.5 text-xs font-medium text-[var(--text-2)] transition-colors hover:border-[var(--border-2)] hover:text-[var(--text-1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              <ExternalLink className="h-4 w-4" />
              Stripe
            </a>
          ) : null}

          {isPaid ? (
            <a
              href={`/api/invoices/${payment.id}/download`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-[var(--r2)] border border-[var(--border-1)] px-3 py-1.5 text-xs font-medium text-[var(--text-2)] transition-colors hover:border-[var(--border-2)] hover:text-[var(--text-1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              <Download className="h-4 w-4" />
              Facture
            </a>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function PaymentStatusBadge({ status }: { status: string }) {
  const statusMap: Record<
    string,
    { label: string; variant: 'success' | 'warning' | 'danger' | 'neutral' }
  > = {
    requires_payment: { label: 'Paiement requis', variant: 'warning' },
    processing: { label: 'En traitement', variant: 'warning' },
    succeeded: { label: 'Paye', variant: 'success' },
    failed: { label: 'Echoue', variant: 'danger' },
    refunded: { label: 'Rembourse', variant: 'danger' },
  };

  const display = statusMap[status] ?? { label: status, variant: 'neutral' as const };

  return <StatusBadge variant={display.variant} label={display.label} />;
}

async function fetchBillingData(userId: string): Promise<BillingData> {
  try {
    const supabase = await getSupabaseSSR();

    const [paymentsRes, profileRes] = await Promise.all([
      supabase
        .from('payments_brand')
        .select(
          'id, contest_id, amount_cents, currency, status, stripe_payment_intent_id, stripe_customer_id, created_at, contest:contest_id(title)'
        )
        .eq('brand_id', userId)
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('stripe_customer_id').eq('id', userId).maybeSingle(),
    ]);

    const paymentsError = paymentsRes.error;
    if (paymentsError) {
      console.error('billing:payments_fetch_error', paymentsError);
      return buildBillingError();
    }

    const profileErrorCode = String((profileRes.error as UnsafeAny)?.code || '');
    if (profileRes.error && profileErrorCode !== '42703') {
      console.error('billing:profile_fetch_error', profileRes.error);
      return buildBillingError();
    }

    const payments = (paymentsRes.data || []).map((payment) => ({
      id: payment.id,
      contest_id: payment.contest_id,
      contest_title: (payment.contest as { title?: string | null } | null)?.title || 'Concours',
      amount_cents: payment.amount_cents || 0,
      currency: payment.currency || 'EUR',
      status: payment.status || 'requires_payment',
      stripe_payment_intent_id: payment.stripe_payment_intent_id,
      stripe_customer_id: (payment as UnsafeAny).stripe_customer_id || null,
      created_at: payment.created_at,
    }));

    const totalPaid = payments
      .filter((payment) => payment.status === 'succeeded')
      .reduce((sum, payment) => sum + payment.amount_cents, 0);
    const pending = payments.filter((payment) => payment.status === 'requires_payment');
    const processing = payments.filter((payment) => payment.status === 'processing');

    const profileStripeCustomerId =
      typeof (profileRes.data as UnsafeAny)?.stripe_customer_id === 'string'
        ? ((profileRes.data as UnsafeAny).stripe_customer_id as string)
        : null;
    const paymentStripeCustomerId =
      payments.find((payment) => typeof payment.stripe_customer_id === 'string')?.stripe_customer_id || null;
    const canOpenPortal = Boolean(profileStripeCustomerId || paymentStripeCustomerId);

    return {
      payments,
      stats: {
        total_paid_cents: totalPaid,
        pending_cents: pending.reduce((sum, payment) => sum + payment.amount_cents, 0),
        pending_count: pending.length,
        processing_cents: processing.reduce((sum, payment) => sum + payment.amount_cents, 0),
        processing_count: processing.length,
      },
      canOpenPortal,
      portalHint: canOpenPortal
        ? ''
        : 'Effectuez votre premier paiement pour activer la facturation et le portail Stripe.',
      error: null,
    };
  } catch (error) {
    console.error('billing:unexpected_error', error);
    return buildBillingError();
  }
}

function buildBillingError(): BillingData {
  return {
    payments: [],
    stats: {
      total_paid_cents: 0,
      pending_cents: 0,
      pending_count: 0,
      processing_cents: 0,
      processing_count: 0,
    },
    canOpenPortal: false,
    portalHint: 'Effectuez votre premier paiement pour activer la facturation et le portail Stripe.',
    error: 'Failed to fetch billing',
  };
}
