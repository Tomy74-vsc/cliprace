import Link from 'next/link';
import { fetchAdminApi } from '@/lib/admin/request';
import { redirect } from 'next/navigation';
import { AdminFilters } from '@/components/admin/admin-filters';
import { AdminLeadActions } from '@/components/admin/admin-lead-actions';
import { AdminLeadCreate } from '@/components/admin/admin-lead-create';
import { AdminTable } from '@/components/admin/admin-table';
import { AdminEntitySelect } from '@/components/admin/admin-entity-select';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatDateTime } from '@/lib/formatters';
import { hasAdminPermission, requireAdminPermission } from '@/lib/admin/rbac';

type LeadItem = {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  status: string;
  source: string | null;
  value_cents: number;
  assigned_to: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  assigned: { id: string; display_name: string | null; email: string | null } | null;
};

type LeadsResponse = {
  items: LeadItem[];
  pagination: { total: number; page: number; limit: number };
  stats: { total: number; status_counts: Record<string, number> };
};

const STATUS_LABELS: Record<string, string> = {
  new: 'Nouveau',
  contacted: 'Contacté',
  qualified: 'Qualifié',
  proposal: 'Proposition',
  won: 'Gagné',
  lost: 'Perdu',
};

function statusVariant(status: string): BadgeProps['variant'] {
  if (status === 'won') return 'success';
  if (status === 'lost') return 'danger';
  if (status === 'proposal') return 'warning';
  if (status === 'qualified') return 'info';
  if (status === 'contacted') return 'secondary';
  return 'default';
}

export default async function AdminCrmPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  let canWrite = false;
  try {
    const { access } = await requireAdminPermission('crm.read');
    canWrite = hasAdminPermission(access, 'crm.write');
  } catch {
    redirect('/forbidden');
  }

  const status = typeof searchParams.status === 'string' ? searchParams.status : '';
  const q = typeof searchParams.q === 'string' ? searchParams.q : '';
  const assignedTo = typeof searchParams.assigned_to === 'string' ? searchParams.assigned_to : '';
  const page = typeof searchParams.page === 'string' ? Number(searchParams.page) : 1;
  const limit = 20;

  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (q) params.set('q', q);
  if (assignedTo) params.set('assigned_to', assignedTo);
  params.set('page', String(page));
  params.set('limit', String(limit));

  const res = await fetchAdminApi(`/api/admin/crm/leads?${params.toString()}`, {
    cache: 'no-store',
  });

  const data: LeadsResponse = res.ok
    ? await res.json()
    : { items: [], pagination: { total: 0, page: 1, limit }, stats: { total: 0, status_counts: {} } };

  const totalPages = Math.max(1, Math.ceil(data.pagination.total / data.pagination.limit));
  const prevHref = `/app/admin/crm?${new URLSearchParams({
    ...Object.fromEntries(params),
    page: String(Math.max(1, page - 1)),
  }).toString()}`;
  const nextHref = `/app/admin/crm?${new URLSearchParams({
    ...Object.fromEntries(params),
    page: String(Math.min(totalPages, page + 1)),
  }).toString()}`;

  return (
    <section className="space-y-6">
      <div>
        <h1 className="display-2">CRM</h1>
        <p className="text-muted-foreground text-sm">
          {data.pagination.total} leads dans le pipeline
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {Object.keys(STATUS_LABELS).map((key) => (
          <Card key={key}>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {STATUS_LABELS[key]}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {data.stats.status_counts[key] ?? 0}
            </CardContent>
          </Card>
        ))}
      </div>

      <AdminLeadCreate canWrite={canWrite} />

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
              placeholder="Nom, email, entreprise"
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
              {Object.keys(STATUS_LABELS).map((value) => (
                <option key={value} value={value}>
                  {STATUS_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
          <AdminEntitySelect
            kind="user"
            name="assigned_to"
            label="Assigné à"
            placeholder="Rechercher un admin..."
            defaultValue={assignedTo || undefined}
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
            <th className="px-4 py-3">Lead</th>
            <th className="px-4 py-3">Company</th>
            <th className="px-4 py-3">Statut</th>
            <th className="px-4 py-3">Value</th>
            <th className="px-4 py-3">Responsable</th>
            <th className="px-4 py-3">Mis à jour</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border text-sm">
          {data.items.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                Aucun lead trouvé
              </td>
            </tr>
          ) : (
            data.items.map((lead) => (
              <tr key={lead.id} className="hover:bg-muted/30">
                <td className="px-4 py-4">
                  <div className="font-medium">{lead.name}</div>
                  <div className="text-xs text-muted-foreground">{lead.email || '-'}</div>
                  <div className="text-xs text-muted-foreground">{lead.id}</div>
                </td>
                <td className="px-4 py-4 text-xs text-muted-foreground">
                  <div>{lead.company || '-'}</div>
                  <div>{lead.source || '-'}</div>
                </td>
                <td className="px-4 py-4">
                  <Badge variant={statusVariant(lead.status)}>{lead.status}</Badge>
                </td>
                <td className="px-4 py-4 font-medium">
                  {formatCurrency(lead.value_cents ?? 0, 'EUR')}
                </td>
                <td className="px-4 py-4 text-xs text-muted-foreground">
                  <div>{lead.assigned?.display_name || lead.assigned?.email || '-'}</div>
                  <div>{lead.assigned_to || '-'}</div>
                </td>
                <td className="px-4 py-4 text-xs text-muted-foreground">
                  {formatDateTime(lead.updated_at || lead.created_at)}
                </td>
                <td className="px-4 py-4">
                  <AdminLeadActions
                    leadId={lead.id}
                    status={lead.status}
                    assignedToId={lead.assigned_to}
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
