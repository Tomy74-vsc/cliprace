import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FileText, ListChecks } from 'lucide-react';

import { fetchAdminApi } from '@/lib/admin/request';
import { hasAdminPermission, requireAdminPermission } from '@/lib/admin/rbac';
import { AdminFilters } from '@/components/admin/admin-filters';
import { AdminInvoiceActions } from '@/components/admin/admin-invoice-actions';
import { AdminTable } from '@/components/admin/admin-table';
import { AdminEntitySelect } from '@/components/admin/admin-entity-select';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatDate } from '@/lib/formatters';

type InvoiceItem = {
  id: string;
  org_id: string;
  stripe_invoice_id: string | null;
  amount_cents: number;
  currency: string;
  vat_rate: number | null;
  pdf_url: string | null;
  status: string;
  issued_at: string | null;
  created_at: string;
  org: { id: string; name: string; billing_email: string | null } | null;
};

type InvoicesResponse = {
  items: InvoiceItem[];
  pagination: { total: number; page: number; limit: number };
};

function statusVariant(status: string): BadgeProps['variant'] {
  if (status === 'paid') return 'success';
  if (status === 'open') return 'warning';
  if (status === 'uncollectible') return 'danger';
  if (status === 'void') return 'secondary';
  return 'default';
}

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

export default async function AdminInvoicesPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  let canWrite = false;
  try {
    const { access } = await requireAdminPermission('invoices.read');
    canWrite = hasAdminPermission(access, 'invoices.write');
  } catch {
    redirect('/forbidden');
  }

  const status = typeof searchParams.status === 'string' ? searchParams.status : '';
  const orgId = typeof searchParams.org_id === 'string' ? searchParams.org_id : '';
  const q = typeof searchParams.q === 'string' ? searchParams.q : '';
  const page = typeof searchParams.page === 'string' ? Number(searchParams.page) : 1;
  const limit = 20;

  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (orgId) params.set('org_id', orgId);
  if (q) params.set('q', q);
  params.set('page', String(page));
  params.set('limit', String(limit));

  const res = await fetchAdminApi(`/api/admin/invoices?${params.toString()}`, {
    cache: 'no-store',
  });

  const data: InvoicesResponse = res.ok
    ? await res.json()
    : { items: [], pagination: { total: 0, page: 1, limit } };

  const totalPages = Math.max(1, Math.ceil(data.pagination.total / data.pagination.limit));
  const prevHref = `/app/admin/invoices?${new URLSearchParams({
    ...Object.fromEntries(params),
    page: String(Math.max(1, page - 1)),
  }).toString()}`;
  const nextHref = `/app/admin/invoices?${new URLSearchParams({
    ...Object.fromEntries(params),
    page: String(Math.min(totalPages, page + 1)),
  }).toString()}`;

  const statusCounts = data.items.reduce(
    (acc, invoice) => {
      if (invoice.status === 'paid') acc.paid += 1;
      else if (invoice.status === 'open') acc.open += 1;
      else if (invoice.status === 'draft') acc.draft += 1;
      else if (invoice.status === 'void') acc.voided += 1;
      else if (invoice.status === 'uncollectible') acc.uncollectible += 1;
      else acc.other += 1;
      return acc;
    },
    { paid: 0, open: 0, draft: 0, voided: 0, uncollectible: 0, other: 0 }
  );

  const pdfCount = data.items.filter((invoice) => invoice.pdf_url).length;
  const uniqueOrgs = new Set(data.items.map((invoice) => invoice.org?.id || invoice.org_id)).size;
  const currencySet = new Set(data.items.map((invoice) => invoice.currency).filter(Boolean));
  const paidTotalCents = data.items.reduce(
    (sum, invoice) => sum + (invoice.status === 'paid' ? invoice.amount_cents : 0),
    0
  );
  const openTotalCents = data.items.reduce(
    (sum, invoice) => sum + (invoice.status === 'open' ? invoice.amount_cents : 0),
    0
  );
  const primaryCurrency = currencySet.size === 1 ? Array.from(currencySet)[0] : null;
  const hasItems = data.items.length > 0;
  const paidTotalLabel = primaryCurrency
    ? formatCurrency(paidTotalCents, primaryCurrency)
    : hasItems
      ? 'Mixed currencies'
      : 'No data';
  const openTotalLabel = primaryCurrency
    ? formatCurrency(openTotalCents, primaryCurrency)
    : hasItems
      ? 'N/A'
      : 'No data';

  return (
    <section className="space-y-8">
      <AdminPageHeader
        title="Invoices"
        description="Track invoices, Stripe sync, and PDF status."
        icon={<FileText className="h-5 w-5" />}
        badges={
          <>
            <Badge variant="secondary">{data.pagination.total} total</Badge>
            <Badge variant="secondary">{statusCounts.paid} paid</Badge>
            <Badge variant="secondary">{statusCounts.open} open</Badge>
            <Badge variant={canWrite ? 'success' : 'secondary'}>
              {canWrite ? 'Write access' : 'Read only'}
            </Badge>
          </>
        }
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/app/admin/finance">Finance</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/app/admin/exports?type=invoices">Export CSV</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Invoices total</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{data.pagination.total}</div>
            <Badge variant="secondary">{data.items.length} on page</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Répartition des statuts (page)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge variant="secondary">Paid {statusCounts.paid}</Badge>
            <Badge variant="secondary">Open {statusCounts.open}</Badge>
            <Badge variant="secondary">Draft {statusCounts.draft}</Badge>
            <Badge variant="secondary">Void {statusCounts.voided}</Badge>
            <Badge variant="secondary">Uncollectible {statusCounts.uncollectible}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Paid total (page)</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{paidTotalLabel}</div>
            <Badge variant="secondary">Open {openTotalLabel}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">PDF coverage (page)</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{pdfCount}</div>
            <Badge variant="secondary">{data.items.length - pdfCount} missing</Badge>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <SectionHeader
          icon={<ListChecks className="h-5 w-5" />}
          title="Registre des factures"
          subtitle="Search by invoice ID, Stripe ID, or organization."
          badges={
            <>
              <Badge variant="secondary">{uniqueOrgs} orgs</Badge>
              <Badge variant="secondary">{statusCounts.paid} paid</Badge>
              <Badge variant="secondary">{statusCounts.open} open</Badge>
            </>
          }
        />

        <Card>
          <CardContent className="space-y-4 pt-6">
            <form>
              <AdminFilters>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="q">
                    Search
                  </label>
                  <input
                    id="q"
                    name="q"
                    defaultValue={q}
                    placeholder="ID facture ou ID Stripe"
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="status">
                    Statut
                  </label>
                  <select
                    id="status"
                    name="status"
                    defaultValue={status || ''}
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  >
                    <option value="">All</option>
                    <option value="draft">Draft</option>
                    <option value="open">Open</option>
                    <option value="paid">Paid</option>
                    <option value="uncollectible">Uncollectible</option>
                    <option value="void">Void</option>
                  </select>
                </div>
                <AdminEntitySelect
                  kind="org"
                  name="org_id"
                  label="Organisation"
                  placeholder="Search an organization..."
                  defaultValue={orgId || undefined}
                />
                <div className="flex items-end gap-2">
                  <Button type="submit" variant="primary">
                    Appliquer
                  </Button>
                  <Button asChild variant="ghost">
                    <Link href="/app/admin/invoices">Réinitialiser</Link>
                  </Button>
                </div>
              </AdminFilters>
            </form>

            <AdminTable>
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Facture</th>
                  <th className="px-4 py-3">Organisation</th>
                  <th className="px-4 py-3">Montant</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Émise</th>
                  <th className="px-4 py-3">PDF</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {data.items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                      Aucune facture trouvée.
                    </td>
                  </tr>
                ) : (
                  data.items.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-muted/30">
                      <td className="px-4 py-4">
                        <div className="font-medium">{invoice.id}</div>
                        <div className="text-xs text-muted-foreground">
                          {invoice.stripe_invoice_id || 'Aucun ID Stripe'}
                        </div>
                        {invoice.vat_rate !== null ? (
                          <div className="text-xs text-muted-foreground">TVA {invoice.vat_rate}%</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-medium">{invoice.org?.name || 'Organisation inconnue'}</div>
                        <div className="text-xs text-muted-foreground">
                          {invoice.org?.billing_email || invoice.org_id}
                        </div>
                      </td>
                      <td className="px-4 py-4 font-medium">
                        {formatCurrency(invoice.amount_cents, invoice.currency)}
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant={statusVariant(invoice.status)}>{invoice.status}</Badge>
                      </td>
                      <td className="px-4 py-4 text-xs text-muted-foreground">
                        {formatDate(invoice.issued_at || invoice.created_at)}
                      </td>
                      <td className="px-4 py-4">
                        {invoice.pdf_url ? (
                          <Button asChild variant="secondary" size="sm">
                            <a
                              href={`/api/admin/invoices/${invoice.id}/download`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Télécharger
                            </a>
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">Aucun PDF</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <AdminInvoiceActions
                          invoiceId={invoice.id}
                          status={invoice.status}
                          hasPdf={Boolean(invoice.pdf_url)}
                          canWrite={canWrite}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </AdminTable>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Page {data.pagination.page} / {totalPages}
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
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
