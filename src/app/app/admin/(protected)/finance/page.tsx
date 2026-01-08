import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DollarSign, ListChecks, ShieldAlert } from 'lucide-react';

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

function SectionHeader({
  icon,
  title,
  subtitle,
  badges,
  actions,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  badges?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl bg-muted/60 border border-border flex items-center justify-center">
          {icon}
        </div>
        <div>
          <div className="font-semibold">{title}</div>
          {subtitle ? <div className="text-sm text-muted-foreground">{subtitle}</div> : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {badges ? <div className="flex items-center gap-2">{badges}</div> : null}
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

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
    <section className="space-y-8">
      <AdminPageHeader
        title="Finance"
        description="Payments, winnings, cashouts, and ledger activity."
        icon={<DollarSign className="h-5 w-5" />}
        badges={
          <Badge variant={canWrite ? 'success' : 'secondary'}>
            {canWrite ? 'Write access' : 'Read only'}
          </Badge>
        }
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/app/admin/invoices">Invoices</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/app/admin/exports">Exports</Link>
            </Button>
          </>
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Brand payments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Collected</span>
              <span className="font-semibold">
                {formatCurrency(summary.payments.collected_cents, 'EUR')}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Pending</span>
              <span className="font-semibold">
                {formatCurrency(summary.payments.pending_cents, 'EUR')}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Refunded</span>
              <span className="font-semibold">
                {formatCurrency(summary.payments.refunded_cents, 'EUR')}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Contest winnings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Distributed</span>
              <span className="font-semibold">
                {formatCurrency(summary.winnings.distributed_cents, 'EUR')}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Pending</span>
              <span className="font-semibold">
                {formatCurrency(summary.winnings.pending_cents, 'EUR')}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cashouts pending</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Count</span>
              <span className="font-semibold">{summary.cashouts.pending_count}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-semibold">
                {formatCurrency(summary.cashouts.pending_cents, 'EUR')}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cashout risk</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Failed</span>
              <span className="font-semibold">{summary.cashouts.failed_count}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Stale &gt; 48h</span>
              <span className="font-semibold">{staleCashouts48h}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {view === 'queue' ? (
        <>
          <div className="space-y-4">
            <SectionHeader
              icon={<ListChecks className="h-5 w-5" />}
              title="Ledger"
              subtitle="Latest 50 finance movements across payments and cashouts."
            />
            <Card>
              <CardContent className="pt-6">
                <AdminFinanceLedger items={ledger.items} />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <SectionHeader
              icon={<ListChecks className="h-5 w-5" />}
              title="Cashout queue"
              subtitle="Review and process creator payouts."
              actions={
                <AdminHelpTooltip
                  label="Cashout guidance"
                  content={
                    <div className="space-y-1">
                      <div className="font-medium">Best practices</div>
                      <div>Start with the oldest requests and verify KYC + risk flags.</div>
                      <div>Every action is recorded in the audit log.</div>
                    </div>
                  }
                />
              }
            />

            <Card>
              <CardContent className="space-y-4 pt-6">
                <form>
                  <AdminFiltersBar resultsCount={cashouts.pagination.total} resetHref="/app/admin/finance">
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-medium text-muted-foreground" htmlFor="status">
                        Cashout status
                      </label>
                      <select
                        id="status"
                        name="status"
                        defaultValue={status}
                        className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                      >
                        <option value="">All</option>
                        <option value="requested">Requested</option>
                        <option value="processing">Processing</option>
                        <option value="paid">Paid</option>
                        <option value="failed">Failed</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <Button type="submit" variant="primary">
                        Apply
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
                      <span className="px-4 py-2 text-xs text-muted-foreground">Prev</span>
                    ) : (
                      <Button asChild variant="secondary" size="sm">
                        <Link href={prevHref}>Prev</Link>
                      </Button>
                    )}
                    {page >= totalPages ? (
                      <span className="px-4 py-2 text-xs text-muted-foreground">Next</span>
                    ) : (
                      <Button asChild variant="secondary" size="sm">
                        <Link href={nextHref}>Next</Link>
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : view === 'anomalies' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Queue anomalies</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {summary.cashouts.failed_count ? (
                <div className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-card p-4">
                  <div>
                    <div className="font-semibold">{summary.cashouts.failed_count} cashouts failed</div>
                    <div className="text-xs text-muted-foreground">
                      Review reasons and retry when possible.
                    </div>
                  </div>
                  <Button asChild size="sm" variant="secondary">
                    <Link href="/app/admin/finance?view=queue&status=failed">Open</Link>
                  </Button>
                </div>
              ) : null}

              {summary.cashouts.pending_count ? (
                <div className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-card p-4">
                  <div>
                    <div className="font-semibold">
                      {summary.cashouts.pending_count} cashouts pending
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Prioritize older requests and verify KYC + risk flags.
                    </div>
                  </div>
                  <Button asChild size="sm" variant="secondary">
                    <Link href="/app/admin/finance?view=queue&status=requested">Open</Link>
                  </Button>
                </div>
              ) : null}

              {staleCashouts48h ? (
                <div className="flex items-start justify-between gap-3 rounded-2xl border border-warning/30 bg-warning/5 p-4">
                  <div>
                    <div className="font-semibold">{staleCashouts48h} cashouts &gt; 48h</div>
                    <div className="text-xs text-muted-foreground">
                      Review the requested queue for stuck items.
                    </div>
                  </div>
                  <Button asChild size="sm" variant="secondary">
                    <Link href="/app/admin/finance?view=queue&status=requested">View</Link>
                  </Button>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No anomalies detected on this page.</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recommendations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <div>1) Handle failed cashouts first.</div>
              <div>2) Verify KYC and risk flags before approval.</div>
              <div>3) Always document a reason for sensitive actions.</div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Reconciliations</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Coming soon: match payments, ledger entries, and cashouts in an actionable view.
          </CardContent>
        </Card>
      )}
    </section>
  );
}
