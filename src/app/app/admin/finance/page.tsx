import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DollarSign } from 'lucide-react';

import { fetchAdminApi } from '@/lib/admin/request';
import { hasAdminPermission, requireAdminPermission } from '@/lib/admin/rbac';
import { AdminCashoutQueue } from '@/components/admin/admin-cashout-queue';
import { AdminFiltersBar } from '@/components/admin/admin-filters-bar';
import { AdminFinanceLedger } from '@/components/admin/admin-finance-ledger';
import { AdminHelpTooltip } from '@/components/admin/admin-help-tooltip';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/formatters';

type FinanceSummary = {
  payments: {
    collected_cents: number;
    pending_cents: number;
    refunded_cents: number;
  };
  winnings: {
    distributed_cents: number;
    pending_cents: number;
  };
  cashouts: {
    pending_cents: number;
    pending_count: number;
    failed_count: number;
  };
};

type LedgerEntry = {
  id: string;
  type: 'payment' | 'cashout' | 'winning';
  amount_cents: number;
  currency: string;
  status: string;
  created_at: string;
  user: { id: string; display_name: string | null; email: string } | null;
  contest: { id: string; title: string } | null;
};

type LedgerResponse = {
  items: LedgerEntry[];
};

type CashoutItem = {
  id: string;
  creator_id: string;
  amount_cents: number;
  currency: string;
  status: string;
  metadata: Record<string, unknown> | null;
  requested_at: string;
  processed_at: string | null;
  creator: { id: string; display_name: string | null; email: string } | null;
  kyc: { provider: string; status: string; reason: string | null; reviewed_at: string | null } | null;
  open_risk_flags: number;
};

type CashoutsResponse = {
  items: CashoutItem[];
  pagination: { total: number; page: number; limit: number };
};

const FALLBACK_SUMMARY: FinanceSummary = {
  payments: { collected_cents: 0, pending_cents: 0, refunded_cents: 0 },
  winnings: { distributed_cents: 0, pending_cents: 0 },
  cashouts: { pending_cents: 0, pending_count: 0, failed_count: 0 },
};

const FALLBACK_LEDGER: LedgerResponse = { items: [] };
const FALLBACK_CASHOUTS: CashoutsResponse = {
  items: [],
  pagination: { total: 0, page: 1, limit: 20 },
};

export default async function AdminFinancePage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  let access: Awaited<ReturnType<typeof requireAdminPermission>>['access'];
  try {
    ({ access } = await requireAdminPermission('finance.read'));
  } catch {
    redirect('/forbidden');
  }
  const canWrite = hasAdminPermission(access, 'finance.write');

  const viewParam = typeof searchParams.view === 'string' ? searchParams.view : 'queue';
  const view = viewParam === 'anomalies' || viewParam === 'reconciliations' ? viewParam : 'queue';

  const statusParam = typeof searchParams.status === 'string' ? searchParams.status : undefined;
  const status = statusParam === undefined ? 'requested' : statusParam;
  const page = typeof searchParams.page === 'string' ? Number(searchParams.page) : 1;
  const limit = 20;

  const cashoutParams = new URLSearchParams();
  cashoutParams.set('status', status);
  cashoutParams.set('page', String(page));
  cashoutParams.set('limit', String(limit));

  const ledgerParams = new URLSearchParams({ limit: '50' });

  const [summaryRes, ledgerRes, cashoutsRes] = await Promise.all([
    fetchAdminApi('/api/admin/finance/summary', { cache: 'no-store' }),
    fetchAdminApi(`/api/admin/finance/ledger?${ledgerParams.toString()}`, { cache: 'no-store' }),
    fetchAdminApi(`/api/admin/cashouts?${cashoutParams.toString()}`, { cache: 'no-store' }),
  ]);

  const summary: FinanceSummary = summaryRes.ok ? await summaryRes.json() : FALLBACK_SUMMARY;
  const ledger: LedgerResponse = ledgerRes.ok ? await ledgerRes.json() : FALLBACK_LEDGER;
  const cashouts: CashoutsResponse = cashoutsRes.ok ? await cashoutsRes.json() : FALLBACK_CASHOUTS;

  const now = Date.now();
  const staleCashouts48h =
    status === 'requested'
      ? cashouts.items.filter((c) => now - new Date(c.requested_at).getTime() > 48 * 60 * 60 * 1000).length
      : 0;

  const totalPages = Math.max(1, Math.ceil(cashouts.pagination.total / cashouts.pagination.limit));
  const prevHref = `/app/admin/finance?${new URLSearchParams({
    ...Object.fromEntries(cashoutParams),
    page: String(Math.max(1, page - 1)),
  }).toString()}`;
  const nextHref = `/app/admin/finance?${new URLSearchParams({
    ...Object.fromEntries(cashoutParams),
    page: String(Math.min(totalPages, page + 1)),
  }).toString()}`;

  return (
    <section className="space-y-6">
      <AdminPageHeader
        title="Finance"
        description="Paiements, gains, cashouts et ledger."
        icon={<DollarSign className="h-5 w-5" />}
        badges={
          <Badge variant={canWrite ? 'success' : 'warning'}>
            {canWrite ? 'Écriture autorisée' : 'Lecture seule'}
          </Badge>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button asChild size="sm" variant={view === 'queue' ? 'primary' : 'secondary'}>
          <Link
            href={`/app/admin/finance?${new URLSearchParams({
              view: 'queue',
              status,
              page: String(page),
            }).toString()}`}
          >
            Queue
          </Link>
        </Button>
        <Button asChild size="sm" variant={view === 'anomalies' ? 'primary' : 'secondary'}>
          <Link href="/app/admin/finance?view=anomalies">Anomalies</Link>
        </Button>
        <Button asChild size="sm" variant={view === 'reconciliations' ? 'primary' : 'secondary'}>
          <Link href="/app/admin/finance?view=reconciliations">Reconciliations</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Paiements marques</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Collecté</span>
              <span className="font-semibold">{formatCurrency(summary.payments.collected_cents, 'EUR')}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">En attente</span>
              <span className="font-semibold">{formatCurrency(summary.payments.pending_cents, 'EUR')}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Remboursé</span>
              <span className="font-semibold">{formatCurrency(summary.payments.refunded_cents, 'EUR')}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Gains concours</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Distribué</span>
              <span className="font-semibold">{formatCurrency(summary.winnings.distributed_cents, 'EUR')}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">À payer</span>
              <span className="font-semibold">{formatCurrency(summary.winnings.pending_cents, 'EUR')}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Cashouts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">En attente</span>
              <span className="font-semibold">
                {summary.cashouts.pending_count} • {formatCurrency(summary.cashouts.pending_cents, 'EUR')}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Échecs</span>
              <span className="font-semibold">{summary.cashouts.failed_count}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {view === 'queue' ? (
        <>
          <div className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold">Ledger</h2>
          <p className="text-muted-foreground text-sm">Derniers mouvements (max 50).</p>
        </div>
        <AdminFinanceLedger items={ledger.items} />
      </div>

      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">File de cashouts</h2>
            <p className="text-muted-foreground text-sm">{cashouts.pagination.total} demande(s)</p>
          </div>
          <AdminHelpTooltip
            label="Aide sur la file de cashouts"
            content={
              <div className="space-y-1">
                <div className="font-medium">Bonnes pratiques</div>
                <div>
                  Filtre par statut et traite d\u2019abord les demandes les plus anciennes. Pour
                  toute action (approuver / pause / rejet), une raison est enregistr\u00e9e dans
                  l\u2019audit.
                </div>
                <div>V\u00e9rifie KYC + risque avant d\u2019approuver.</div>
              </div>
            }
          />
        </div>

        <form>
          <AdminFiltersBar resultsCount={cashouts.pagination.total} resetHref="/app/admin/finance">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="status">
                Statut cashout
              </label>
              <select
                id="status"
                name="status"
                defaultValue={status}
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
              >
                <option value="">Tous</option>
                <option value="requested">Demandé</option>
                <option value="processing">En traitement</option>
                <option value="paid">Payé</option>
                <option value="failed">Échec</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button type="submit" variant="primary">
                Filtrer
              </Button>
            </div>
          </AdminFiltersBar>
        </form>

        <AdminCashoutQueue items={cashouts.items} canWrite={canWrite} />

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {cashouts.pagination.page} / {totalPages}
          </span>
          <div className="flex items-center gap-2">
            {page <= 1 ? (
              <span className="px-4 py-2 text-xs text-muted-foreground">Précédent</span>
            ) : (
              <Button asChild variant="secondary" size="sm">
                <Link href={prevHref}>Précédent</Link>
              </Button>
            )}
            {page >= totalPages ? (
              <span className="px-4 py-2 text-xs text-muted-foreground">Suivant</span>
            ) : (
              <Button asChild variant="secondary" size="sm">
                <Link href={nextHref}>Suivant</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
        </>
      ) : view === 'anomalies' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">À traiter</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {summary.cashouts.failed_count ? (
                <div className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-card p-4">
                  <div>
                    <div className="font-semibold">{summary.cashouts.failed_count} cashout(s) en échec</div>
                    <div className="text-xs text-muted-foreground">Vérifie les raisons et relance si possible.</div>
                  </div>
                  <Button asChild size="sm" variant="secondary">
                    <Link href="/app/admin/finance?view=queue&status=failed">Ouvrir</Link>
                  </Button>
                </div>
              ) : null}

              {summary.cashouts.pending_count ? (
                <div className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-card p-4">
                  <div>
                    <div className="font-semibold">
                      {summary.cashouts.pending_count} cashout(s) en attente
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Priorise les plus anciennes et vérifie KYC/risque.
                    </div>
                  </div>
                  <Button asChild size="sm" variant="secondary">
                    <Link href="/app/admin/finance?view=queue&status=requested">Ouvrir</Link>
                  </Button>
                </div>
              ) : null}

              {staleCashouts48h ? (
                <div className="flex items-start justify-between gap-3 rounded-2xl border border-warning/30 bg-warning/5 p-4">
                  <div>
                    <div className="font-semibold">{staleCashouts48h} cashout(s) &gt; 48h</div>
                    <div className="text-xs text-muted-foreground">Anomalie sur la file “Demandé”.</div>
                  </div>
                  <Button asChild size="sm" variant="secondary">
                    <Link href="/app/admin/finance?view=queue&status=requested">Voir</Link>
                  </Button>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Aucune anomalie évidente sur la page courante.</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recommandations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <div>1) Traite les cashouts “Échec” en priorité.</div>
              <div>2) Vérifie KYC + flags risque avant d’approuver.</div>
              <div>3) Documente la raison pour toute action sensible.</div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reconciliations</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            À venir : rapprochements paiements ↔ ledger ↔ cashouts (vue actionnable).
          </CardContent>
        </Card>
      )}
    </section>
  );
}
