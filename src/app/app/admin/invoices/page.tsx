import Link from 'next/link';
import { redirect } from 'next/navigation';
import { fetchAdminApi } from '@/lib/admin/request';
import { hasAdminPermission, requireAdminPermission } from '@/lib/admin/rbac';
import { AdminFilters } from '@/components/admin/admin-filters';
import { AdminInvoiceActions } from '@/components/admin/admin-invoice-actions';
import { AdminTable } from '@/components/admin/admin-table';
import { AdminEntitySelect } from '@/components/admin/admin-entity-select';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

  return (
    <section className="space-y-6">
      <div>
        <h1 className="display-2">Factures</h1>
        <p className="text-muted-foreground text-sm">
          {data.pagination.total} factures au total
        </p>
      </div>

      <form>
        <AdminFilters>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="q">
              Recherche
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
              <option value="">Tous</option>
              <option value="draft">Brouillon</option>
              <option value="open">Ouverte</option>
              <option value="paid">Payée</option>
              <option value="uncollectible">Irrécouvrable</option>
              <option value="void">Annulée</option>
            </select>
          </div>
          <AdminEntitySelect
            kind="org"
            name="org_id"
            label="Organisation"
            placeholder="Rechercher une organisation..."
            defaultValue={orgId || undefined}
          />
          <div className="flex items-end">
            <Button type="submit" variant="primary">
              Filtrer
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
                Aucune facture trouvée
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
                      <a href={invoice.pdf_url} target="_blank" rel="noopener noreferrer">
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
    </section>
  );
}

