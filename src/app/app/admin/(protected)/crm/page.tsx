import Link from 'next/link';
import { fetchAdminApi } from '@/lib/admin/request';
import { redirect } from 'next/navigation';
import { Briefcase, ListChecks, PlusCircle } from 'lucide-react';
import { AdminFilters } from '@/components/admin/admin-filters';
import { AdminLeadActions } from '@/components/admin/admin-lead-actions';
import { AdminLeadCreate } from '@/components/admin/admin-lead-create';
import { AdminTable } from '@/components/admin/admin-table';
import { AdminEntitySelect } from '@/components/admin/admin-entity-select';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
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
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  proposal: 'Proposal',
  won: 'Won',
  lost: 'Lost',
};

function statusVariant(status: string): BadgeProps['variant'] {
  if (status === 'won') return 'success';
  if (status === 'lost') return 'danger';
  if (status === 'proposal') return 'warning';
  if (status === 'qualified') return 'info';
  if (status === 'contacted') return 'secondary';
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

  const newCount = data.stats.status_counts.new ?? 0;
  const contactedCount = data.stats.status_counts.contacted ?? 0;
  const qualifiedCount = data.stats.status_counts.qualified ?? 0;
  const proposalCount = data.stats.status_counts.proposal ?? 0;
  const wonCount = data.stats.status_counts.won ?? 0;
  const lostCount = data.stats.status_counts.lost ?? 0;

  const totalValue = data.items.reduce((sum, lead) => sum + (lead.value_cents ?? 0), 0);
  const assignedCount = data.items.filter((lead) => Boolean(lead.assigned_to)).length;

  return (
    <section className="space-y-8">
      <AdminPageHeader
        title="CRM"
        description="Track your pipeline, value, and team ownership."
        icon={<Briefcase className="h-5 w-5" />}
        badges={
          <>
            <Badge variant="secondary">{data.pagination.total} leads</Badge>
            <Badge variant="secondary">{qualifiedCount} qualified</Badge>
            <Badge variant="secondary">{wonCount} won</Badge>
          </>
        }
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/app/admin/brands">Brands</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/app/admin/users">Users</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pipeline value</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{formatCurrency(totalValue, 'EUR')}</div>
            <Badge variant="secondary">{data.items.length} on page</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Assigned leads</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{assignedCount}</div>
            <Badge variant="secondary">{data.items.length - assignedCount} unassigned</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Qualified</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{qualifiedCount}</div>
            <Badge variant="secondary">On page</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Won vs lost</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge variant="secondary">Won {wonCount}</Badge>
            <Badge variant="secondary">Lost {lostCount}</Badge>
            <Badge variant="secondary">Proposal {proposalCount}</Badge>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <SectionHeader
          icon={<PlusCircle className="h-5 w-5" />}
          title="Create lead"
          subtitle="Capture inbound interest and assign ownership."
          badges={canWrite ? <Badge variant="secondary">Ready</Badge> : <Badge variant="secondary">Read only</Badge>}
        />
        <AdminLeadCreate canWrite={canWrite} />
      </div>

      <div className="space-y-4">
        <SectionHeader
          icon={<ListChecks className="h-5 w-5" />}
          title="Lead pipeline"
          subtitle="Filter by status, owner, or search terms."
          badges={
            <>
              <Badge variant="secondary">New {newCount}</Badge>
              <Badge variant="secondary">Contacted {contactedCount}</Badge>
              <Badge variant="secondary">Qualified {qualifiedCount}</Badge>
              <Badge variant="secondary">Proposal {proposalCount}</Badge>
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
                    placeholder="Name, email, company"
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
                    <Link href="/app/admin/crm">Reset</Link>
                  </Button>
                </div>
              </AdminFilters>
            </form>

            <AdminTable>
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Lead</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Value</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {data.items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                      No leads found.
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
