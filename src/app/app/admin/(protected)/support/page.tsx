import Link from 'next/link';
import { fetchAdminApi } from '@/lib/admin/request';
import { redirect } from 'next/navigation';
import { Inbox, LifeBuoy, PlusCircle } from 'lucide-react';
import { AdminFilters } from '@/components/admin/admin-filters';
import { AdminSupportActions } from '@/components/admin/admin-support-actions';
import { AdminSupportCreate } from '@/components/admin/admin-support-create';
import { AdminTable } from '@/components/admin/admin-table';
import { AdminEntitySelect } from '@/components/admin/admin-entity-select';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
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
  open: 'Open',
  pending: 'Pending',
  resolved: 'Resolved',
  closed: 'Closed',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
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

function formatStatusLabel(status: string) {
  return STATUS_LABELS[status] ?? status;
}

function formatPriorityLabel(priority: string) {
  return PRIORITY_LABELS[priority] ?? priority;
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
  const openCount = data.stats.status_counts.open ?? 0;
  const pendingCount = data.stats.status_counts.pending ?? 0;
  const resolvedCount = data.stats.status_counts.resolved ?? 0;
  const closedCount = data.stats.status_counts.closed ?? 0;
  const doneCount = resolvedCount + closedCount;
  const pageItems = data.items.length;
  const unassignedCount = data.items.reduce(
    (count, ticket) => count + (ticket.assigned_to ? 0 : 1),
    0
  );
  const pendingOnPage = data.items.filter((ticket) => ticket.status === 'pending').length;

  const prevHref = `/app/admin/support?${new URLSearchParams({
    ...Object.fromEntries(params),
    page: String(Math.max(1, page - 1)),
  }).toString()}`;
  const nextHref = `/app/admin/support?${new URLSearchParams({
    ...Object.fromEntries(params),
    page: String(Math.min(totalPages, page + 1)),
  }).toString()}`;

  return (
    <section className="space-y-8">
      <AdminPageHeader
        title="Support"
        description="Track tickets, manage priorities, and keep response times tight."
        icon={<LifeBuoy className="h-5 w-5" />}
        badges={
          <>
            <Badge variant="secondary">{data.pagination.total.toLocaleString()} tickets</Badge>
            <Badge variant="secondary">{openCount.toLocaleString()} open</Badge>
            <Badge variant="secondary">{pendingCount.toLocaleString()} pending</Badge>
          </>
        }
        actions={
          <Button asChild variant="secondary">
            <Link href="/app/admin/inbox?kind=ops">Inbox</Link>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total tickets</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{data.pagination.total.toLocaleString()}</div>
            <Badge variant="secondary">{pageItems.toLocaleString()} on page</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Open</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{openCount.toLocaleString()}</div>
            <Badge variant="secondary">{unassignedCount.toLocaleString()} unassigned (page)</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{pendingCount.toLocaleString()}</div>
            <Badge variant="secondary">{pendingOnPage.toLocaleString()} on page</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Done</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <div className="text-2xl font-semibold">{doneCount.toLocaleString()}</div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Resolved {resolvedCount}</Badge>
              <Badge variant="secondary">Closed {closedCount}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <SectionHeader
          icon={<PlusCircle className="h-5 w-5" />}
          title="Create ticket"
          subtitle="Log a new request and assign it to the right owner."
          badges={canWrite ? <Badge variant="secondary">Ready</Badge> : <Badge variant="secondary">Read only</Badge>}
        />
        <AdminSupportCreate canWrite={canWrite} />
      </div>

      <div className="space-y-4">
        <SectionHeader
          icon={<Inbox className="h-5 w-5" />}
          title="Ticket queue"
          subtitle="Triage, assign, and update ticket status."
          badges={
            <>
              <Badge variant="secondary">Open {openCount}</Badge>
              <Badge variant="secondary">Pending {pendingCount}</Badge>
              <Badge variant="secondary">Done {doneCount}</Badge>
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
                    placeholder="Subject, email, ticket id"
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="status">
                    Status
                  </label>
                  <select
                    id="status"
                    name="status"
                    defaultValue={status || ''}
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  >
                    <option value="">All</option>
                    {Object.keys(STATUS_LABELS).map((value) => (
                      <option key={value} value={value}>
                        {STATUS_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="priority">
                    Priority
                  </label>
                  <select
                    id="priority"
                    name="priority"
                    defaultValue={priority || ''}
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  >
                    <option value="">All</option>
                    {Object.keys(PRIORITY_LABELS).map((value) => (
                      <option key={value} value={value}>
                        {PRIORITY_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </div>
                <AdminEntitySelect
                  kind="user"
                  name="assigned_to"
                  label="Assigned to"
                  placeholder="Search an admin..."
                  defaultValue={assignedTo || undefined}
                />
                <div className="flex items-end gap-2">
                  <Button type="submit" variant="primary">
                    Apply
                  </Button>
                  <Button asChild variant="ghost">
                    <Link href="/app/admin/support">Reset</Link>
                  </Button>
                </div>
              </AdminFilters>
            </form>

            <div className="overflow-x-auto">
              <AdminTable>
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Ticket</th>
                    <th className="px-4 py-3">Requester</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Priority</th>
                    <th className="px-4 py-3">Assigned</th>
                    <th className="px-4 py-3">Notes</th>
                    <th className="px-4 py-3">Updated</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-sm">
                  {data.items.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">
                        No tickets found.
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
                          <div>
                            {ticket.requester?.display_name ||
                              ticket.requester?.email ||
                              ticket.email ||
                              'Unknown'}
                          </div>
                          <div>{ticket.email || ticket.user_id || '-'}</div>
                        </td>
                        <td className="px-4 py-4">
                          <Badge variant={statusVariant(ticket.status)}>
                            {formatStatusLabel(ticket.status)}
                          </Badge>
                        </td>
                        <td className="px-4 py-4">
                          <Badge variant={priorityVariant(ticket.priority)}>
                            {formatPriorityLabel(ticket.priority)}
                          </Badge>
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
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Page {data.pagination.page} / {totalPages}
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
    </section>
  );
}
