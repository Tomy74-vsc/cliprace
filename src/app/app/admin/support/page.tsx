import Link from 'next/link';
import { fetchAdminApi } from '@/lib/admin/request';
import { redirect } from 'next/navigation';
import { AdminFilters } from '@/components/admin/admin-filters';
import { AdminSupportActions } from '@/components/admin/admin-support-actions';
import { AdminSupportCreate } from '@/components/admin/admin-support-create';
import { AdminTable } from '@/components/admin/admin-table';
import { AdminEntitySelect } from '@/components/admin/admin-entity-select';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateTime } from '@/lib/formatters';
import { hasAdminPermission, requireAdminPermission } from '@/lib/admin/rbac';

type TicketItem = {
  id: string;
  user_id: string | null;
  email: string | null;
  subject: string;
  status: string;
  priority: string;
  assigned_to: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
  requester: { id: string; display_name: string | null; email: string | null } | null;
  assignee: { id: string; display_name: string | null; email: string | null } | null;
};

type TicketsResponse = {
  items: TicketItem[];
  pagination: { total: number; page: number; limit: number };
  stats: { total: number; status_counts: Record<string, number> };
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Ouvert',
  pending: 'En attente',
  resolved: 'Résolu',
  closed: 'Fermé',
};

function statusVariant(status: string): BadgeProps['variant'] {
  if (status === 'resolved') return 'success';
  if (status === 'closed') return 'secondary';
  if (status === 'pending') return 'warning';
  return 'default';
}

function priorityVariant(priority: string): BadgeProps['variant'] {
  if (priority === 'urgent') return 'danger';
  if (priority === 'high') return 'warning';
  if (priority === 'medium') return 'info';
  return 'default';
}

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  let canWrite = false;
  try {
    const { access } = await requireAdminPermission('support.read');
    canWrite = hasAdminPermission(access, 'support.write');
  } catch {
    redirect('/forbidden');
  }

  const status = typeof searchParams.status === 'string' ? searchParams.status : '';
  const priority = typeof searchParams.priority === 'string' ? searchParams.priority : '';
  const q = typeof searchParams.q === 'string' ? searchParams.q : '';
  const assignedTo = typeof searchParams.assigned_to === 'string' ? searchParams.assigned_to : '';
  const page = typeof searchParams.page === 'string' ? Number(searchParams.page) : 1;
  const limit = 20;

  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (priority) params.set('priority', priority);
  if (q) params.set('q', q);
  if (assignedTo) params.set('assigned_to', assignedTo);
  params.set('page', String(page));
  params.set('limit', String(limit));

  const res = await fetchAdminApi(`/api/admin/support/tickets?${params.toString()}`, {
    cache: 'no-store',
  });

  const data: TicketsResponse = res.ok
    ? await res.json()
    : { items: [], pagination: { total: 0, page: 1, limit }, stats: { total: 0, status_counts: {} } };

  const totalPages = Math.max(1, Math.ceil(data.pagination.total / data.pagination.limit));
  const prevHref = `/app/admin/support?${new URLSearchParams({
    ...Object.fromEntries(params),
    page: String(Math.max(1, page - 1)),
  }).toString()}`;
  const nextHref = `/app/admin/support?${new URLSearchParams({
    ...Object.fromEntries(params),
    page: String(Math.min(totalPages, page + 1)),
  }).toString()}`;

  return (
    <section className="space-y-6">
      <div>
        <h1 className="display-2">Support</h1>
        <p className="text-muted-foreground text-sm">
          {data.pagination.total} tickets au total
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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

      <AdminSupportCreate canWrite={canWrite} />

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
              placeholder="Sujet, email, id ticket"
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
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="priority">
              Priorité
            </label>
            <select
              id="priority"
              name="priority"
              defaultValue={priority || ''}
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
            >
              <option value="">Toutes</option>
              <option value="low">Basse</option>
              <option value="medium">Moyenne</option>
              <option value="high">Haute</option>
              <option value="urgent">Urgente</option>
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
            <th className="px-4 py-3">Ticket</th>
            <th className="px-4 py-3">Requester</th>
            <th className="px-4 py-3">Statut</th>
            <th className="px-4 py-3">Priority</th>
            <th className="px-4 py-3">Assigned</th>
            <th className="px-4 py-3">Notes</th>
            <th className="px-4 py-3">Mis à jour</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border text-sm">
          {data.items.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">
                Aucun ticket trouvé
              </td>
            </tr>
          ) : (
            data.items.map((ticket) => (
              <tr key={ticket.id} className="hover:bg-muted/30">
                <td className="px-4 py-4">
                  <div className="font-medium">{ticket.subject}</div>
                  <div className="text-xs text-muted-foreground">{ticket.id}</div>
                </td>
                <td className="px-4 py-4 text-xs text-muted-foreground">
                  <div>{ticket.requester?.display_name || ticket.requester?.email || 'inconnu'}</div>
                  <div>{ticket.email || ticket.user_id || '-'}</div>
                </td>
                <td className="px-4 py-4">
                  <Badge variant={statusVariant(ticket.status)}>{ticket.status}</Badge>
                </td>
                <td className="px-4 py-4">
                  <Badge variant={priorityVariant(ticket.priority)}>{ticket.priority}</Badge>
                </td>
                <td className="px-4 py-4 text-xs text-muted-foreground">
                  <div>{ticket.assignee?.display_name || ticket.assignee?.email || '-'}</div>
                  <div>{ticket.assigned_to || '-'}</div>
                </td>
                <td className="px-4 py-4 text-xs text-muted-foreground">
                  {ticket.internal_notes ? ticket.internal_notes.slice(0, 120) : '-'}
                </td>
                <td className="px-4 py-4 text-xs text-muted-foreground">
                  {formatDateTime(ticket.updated_at || ticket.created_at)}
                </td>
                <td className="px-4 py-4">
                  <AdminSupportActions
                    ticketId={ticket.id}
                    status={ticket.status || 'open'}
                    priority={ticket.priority || 'medium'}
                    assignedToId={ticket.assigned_to}
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
