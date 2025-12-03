/*
Page: Brand billing
Objectifs: liste des paiements (payments_brand), factures, statuts, actions (régler, télécharger facture)
*/
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BrandEmptyState } from '@/components/brand/empty-state-enhanced';
import { StatCard } from '@/components/creator/stat-card';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { DollarSign, CheckCircle2, Clock, XCircle, RefreshCw, Download, ExternalLink } from 'lucide-react';
import { TrackOnView } from '@/components/analytics/track-once';

export const revalidate = 60;

export default async function BrandBillingPage() {
  const { user } = await getSession();
  if (!user) return null;

  const { payments, stats, error } = await fetchPayments(user.id);

  if (error) {
    return (
      <main className="space-y-6">
        <BrandEmptyState
          type="default"
          title="Erreur de chargement"
          description="Impossible de charger les paiements. Réessaie plus tard ou contacte le support."
          action={{ label: 'Réessayer', href: '/app/brand/billing', variant: 'secondary' }}
        />
      </main>
    );
  }

  return (
    <main className="space-y-8">
      <TrackOnView event="view_brand_billing" payload={{ total: payments.length }} />

      {/* En-tête */}
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">Factures & Paiements</h1>
        <p className="text-muted-foreground">
          Gère tes paiements, consulte tes factures et l&apos;historique de tes transactions.
        </p>
      </div>

      {/* Résumé transparent */}
      {stats && (
        <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-accent/5 to-background">
          <CardHeader>
            <CardTitle>Résumé de tes dépenses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-lg font-medium">
                Vous avez dépensé <span className="text-primary font-semibold">{formatCurrency(stats.total_paid_cents, 'EUR')}</span> au total sur ClipRace.
              </p>
              {stats.total_views > 0 ? (
                <p className="text-base text-muted-foreground">
                  Vos campagnes ont généré <span className="font-semibold text-foreground">{stats.total_views.toLocaleString()}</span> vues au total, soit{' '}
                  <span className="font-semibold text-foreground">
                    {formatCurrency(Math.round((stats.total_paid_cents / stats.total_views) * 1000), 'EUR')}
                  </span>{' '}
                  pour 1 000 vues.
                </p>
              ) : (
                <p className="text-base text-muted-foreground">
                  Vos campagnes n&apos;ont pas encore généré de vues. Les métriques apparaîtront ici une fois les concours actifs.
                </p>
              )}
              <p className="text-sm text-muted-foreground italic">
                Pas d&apos;abonnement caché. Vous payez uniquement le cashprize de vos concours + une commission transparente.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats détaillées */}
      {stats && (
        <section>
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard
              label="Total payé"
              value={formatCurrency(stats.total_paid_cents, 'EUR')}
              hint="Tous concours confondus"
              icon={<CheckCircle2 className="h-4 w-4" />}
            />
            <StatCard
              label="En attente"
              value={formatCurrency(stats.pending_cents, 'EUR')}
              hint={`${stats.pending_count} paiement${stats.pending_count > 1 ? 's' : ''}`}
              icon={<Clock className="h-4 w-4" />}
            />
            <StatCard
              label="En traitement"
              value={formatCurrency(stats.processing_cents, 'EUR')}
              hint={`${stats.processing_count} paiement${stats.processing_count > 1 ? 's' : ''}`}
              icon={<RefreshCw className="h-4 w-4" />}
            />
            <StatCard
              label="Total transactions"
              value={String(payments.length)}
              hint="Historique complet"
              icon={<DollarSign className="h-4 w-4" />}
            />
          </div>
        </section>
      )}

      {/* Liste des paiements */}
      {payments.length === 0 ? (
        <BrandEmptyState
          type="no-payments"
          title="Aucun paiement"
          description="Tu n'as pas encore effectué de paiement. Les paiements apparaîtront ici après la création d'un concours."
          action={{
            label: 'Créer un concours',
            href: '/app/brand/contests/new',
            variant: 'primary',
          }}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Historique des paiements</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-border bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Campagne</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Montant payé (TTC)</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Statut</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Date</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Facture PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <PaymentRow key={payment.id} payment={payment} />
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Informations */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle>Informations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            • Les paiements sont traités de manière sécurisée via Stripe. Tu recevras une confirmation par email.
          </p>
          <p>
            • Les factures sont disponibles dans ton portail Stripe. Tu peux y accéder depuis chaque paiement.
          </p>
          <p>
            • En cas de problème, contacte le support via{' '}
            <Link href="/app/brand/faq" className="text-primary hover:underline">
              la FAQ
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

interface PaymentRowProps {
  payment: {
    id: string;
    contest_id: string;
    contest_title: string;
    amount_cents: number;
    currency: string;
    status: string;
    stripe_checkout_session_id: string | null;
    stripe_payment_intent_id: string | null;
    created_at: string;
    updated_at: string;
  };
}

function PaymentRow({ payment }: PaymentRowProps) {
  const statusLabels: Record<string, string> = {
    requires_payment: 'Paiement requis',
    processing: 'En traitement',
    succeeded: 'Payé',
    failed: 'Échoué',
    refunded: 'Remboursé',
  };

  const statusVariants: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
    requires_payment: 'warning',
    processing: 'info',
    succeeded: 'success',
    failed: 'danger',
    refunded: 'default',
  };

  const statusIcons: Record<string, React.ReactNode> = {
    requires_payment: <Clock className="h-4 w-4" />,
    processing: <RefreshCw className="h-4 w-4" />,
    succeeded: <CheckCircle2 className="h-4 w-4" />,
    failed: <XCircle className="h-4 w-4" />,
    refunded: <RefreshCw className="h-4 w-4" />,
  };

  const needsPayment = payment.status === 'requires_payment' || payment.status === 'processing';
  const isPaid = payment.status === 'succeeded';

  return (
    <tr className="border-b border-border/60 hover:bg-muted/40 transition-colors">
      <td className="px-4 py-3">
        <Link
          href={`/app/brand/contests/${payment.contest_id}`}
          className="font-medium text-foreground hover:text-primary transition-colors"
        >
          {payment.contest_title}
        </Link>
      </td>
      <td className="px-4 py-3">
        <span className="font-semibold">
          {formatCurrency(payment.amount_cents, payment.currency)}
        </span>
      </td>
      <td className="px-4 py-3">
        <Badge variant={statusVariants[payment.status] || 'default'} className="flex items-center gap-1 w-fit">
          {statusIcons[payment.status]}
          {statusLabels[payment.status] || payment.status}
        </Badge>
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {formatDate(payment.created_at)}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {needsPayment && (
            <Button asChild size="sm" variant="primary">
              <Link href={`/app/brand/contests/${payment.contest_id}`}>Régler</Link>
            </Button>
          )}
          {isPaid && payment.stripe_payment_intent_id && (
            <Button asChild size="sm" variant="secondary">
              <a
                href={`https://dashboard.stripe.com/payments/${payment.stripe_payment_intent_id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Voir sur Stripe
              </a>
            </Button>
          )}
          {isPaid && (
            <Button
              asChild
              size="sm"
              variant="ghost"
              className="flex items-center gap-1"
            >
              <a
                href={`/api/invoices/${payment.id}/download`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Download className="h-4 w-4" />
                Facture
              </a>
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

async function fetchPayments(userId: string) {
  const supabase = await getSupabaseSSR();

  // Récupérer tous les paiements de la marque
  const { data: paymentsData, error } = await supabase
    .from('payments_brand')
    .select(
      'id, contest_id, amount_cents, currency, status, stripe_checkout_session_id, stripe_payment_intent_id, created_at, updated_at, contest:contest_id(title)'
    )
    .eq('brand_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Payments fetch error', error);
    return { error: 'Failed to fetch payments', payments: [], stats: null };
  }

  // Récupérer les titres des concours
  const payments = (paymentsData || []).map((payment) => ({
    id: payment.id,
    contest_id: payment.contest_id,
    contest_title: (payment.contest as { title?: string | null } | null)?.title || 'Concours',
    amount_cents: payment.amount_cents,
    currency: payment.currency || 'EUR',
    status: payment.status,
    stripe_checkout_session_id: payment.stripe_checkout_session_id,
    stripe_payment_intent_id: payment.stripe_payment_intent_id,
    created_at: payment.created_at,
    updated_at: payment.updated_at,
  }));

  // Récupérer les vues totales pour les concours payés
  const succeededPayments = payments.filter((p) => p.status === 'succeeded');
  const contestIds = succeededPayments.map((p) => p.contest_id);
  
  let totalViews = 0;
  if (contestIds.length > 0) {
    // Récupérer les soumissions approuvées pour ces concours
    const { data: submissions } = await supabase
      .from('submissions')
      .select('id')
      .in('contest_id', contestIds)
      .eq('status', 'approved');
    
    const submissionIds = submissions?.map((s) => s.id) || [];
    
    if (submissionIds.length > 0) {
      // Agréger les vues depuis metrics_daily
      const { data: metrics } = await supabase
        .from('metrics_daily')
        .select('views')
        .in('submission_id', submissionIds);
      
      totalViews = metrics?.reduce((sum, m) => sum + (m.views || 0), 0) || 0;
    }
  }

  // Calculer les stats
  const stats = {
    total_paid_cents: succeededPayments.reduce((sum, p) => sum + p.amount_cents, 0),
    total_views: totalViews,
    pending_cents: payments
      .filter((p) => p.status === 'requires_payment')
      .reduce((sum, p) => sum + p.amount_cents, 0),
    pending_count: payments.filter((p) => p.status === 'requires_payment').length,
    processing_cents: payments
      .filter((p) => p.status === 'processing')
      .reduce((sum, p) => sum + p.amount_cents, 0),
    processing_count: payments.filter((p) => p.status === 'processing').length,
  };

  return {
    payments,
    stats,
    error: null,
  };
}

