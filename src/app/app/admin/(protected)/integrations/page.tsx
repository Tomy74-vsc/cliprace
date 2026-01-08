import Link from 'next/link';
import { fetchAdminApi } from '@/lib/admin/request';
import { redirect } from 'next/navigation';
import { Globe, Inbox, Plug } from 'lucide-react';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { AdminFilters } from '@/components/admin/admin-filters';
import { AdminTable } from '@/components/admin/admin-table';
import { AdminEntitySelect } from '@/components/admin/admin-entity-select';
import { AdminHelpTooltip } from '@/components/admin/admin-help-tooltip';
import { AdminObjectSummary } from '@/components/admin/admin-object-summary';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateTime } from '@/lib/formatters';

type EndpointItem = {
  id: string;
  org_id: string;
  endpoint_url: string;
  active: boolean;
  created_at: string;
  updated_at: string;
  org: { id: string; name: string | null; billing_email: string | null } | null;
};

type DeliveryItem = {
  id: number;
  endpoint_id: string;
  event: string;
  status: string;
  retry_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  payload: unknown;
  endpoint:
    | {
        id: string;
        org_id: string;
        endpoint_url: string;
        org: { id: string; name: string | null } | null;
      }
    | null;
};

type Paged<T> = { items: T[]; pagination: { total: number; page: number; limit: number } };

function activeVariant(active: boolean): BadgeProps['variant'] {
  return active ? 'success' : 'secondary';
}

function statusVariant(status: string): BadgeProps['variant'] {
  if (status === 'success') return 'success';
  if (status === 'failed') return 'danger';
  if (status === 'pending') return 'warning';
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

export default async function AdminIntegrationsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  try {
    await requireAdminPermission('integrations.read');
  } catch {
    redirect('/forbidden');
  }

  const endpointQ = typeof searchParams.endpoint_q === 'string' ? searchParams.endpoint_q : '';
  const endpointOrgId =
    typeof searchParams.endpoint_org_id === 'string' ? searchParams.endpoint_org_id : '';
  const endpointActive =
    typeof searchParams.endpoint_active === 'string' ? searchParams.endpoint_active : '';
  const endpointPage =
    typeof searchParams.endpoint_page === 'string' ? Number(searchParams.endpoint_page) : 1;

  const deliveryQ = typeof searchParams.delivery_q === 'string' ? searchParams.delivery_q : '';
  const deliveryOrgId =
    typeof searchParams.delivery_org_id === 'string' ? searchParams.delivery_org_id : '';
  const deliveryStatus =
    typeof searchParams.delivery_status === 'string' ? searchParams.delivery_status : '';
  const deliveryEvent =
    typeof searchParams.delivery_event === 'string' ? searchParams.delivery_event : '';
  const deliveryPage =
    typeof searchParams.delivery_page === 'string' ? Number(searchParams.delivery_page) : 1;

  const endpointParams = new URLSearchParams();
  if (endpointQ) endpointParams.set('q', endpointQ);
  if (endpointOrgId) endpointParams.set('org_id', endpointOrgId);
  if (endpointActive) endpointParams.set('active', endpointActive);
  endpointParams.set('page', String(endpointPage));
  endpointParams.set('limit', '20');

  const deliveryParams = new URLSearchParams();
  if (deliveryQ) deliveryParams.set('q', deliveryQ);
  if (deliveryOrgId) deliveryParams.set('org_id', deliveryOrgId);
  if (deliveryStatus) deliveryParams.set('status', deliveryStatus);
  if (deliveryEvent) deliveryParams.set('event', deliveryEvent);
  deliveryParams.set('page', String(deliveryPage));
  deliveryParams.set('limit', '20');

  const [endpointsRes, deliveriesRes, statsRes] = await Promise.all([
    fetchAdminApi(`/api/admin/webhook-endpoints?${endpointParams.toString()}`, { cache: 'no-store' }),
    fetchAdminApi(`/api/admin/webhook-deliveries?${deliveryParams.toString()}`, {
      cache: 'no-store',
    }),
    fetchAdminApi('/api/admin/webhook-deliveries/stats?range=24h', { cache: 'no-store' }),
  ]);

  const endpoints: Paged<EndpointItem> = endpointsRes.ok
    ? await endpointsRes.json()
    : { items: [], pagination: { total: 0, page: 1, limit: 20 } };
  const deliveries: Paged<DeliveryItem> = deliveriesRes.ok
    ? await deliveriesRes.json()
    : { items: [], pagination: { total: 0, page: 1, limit: 20 } };

  const stats: { top: Array<{ error: string; count: number }>; total_failed: number } = statsRes.ok
    ? await statsRes.json()
    : { top: [], total_failed: 0 };

  const baseParams = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === 'string') baseParams.set(key, value);
  }

  const endpointTotalPages = Math.max(1, Math.ceil(endpoints.pagination.total / 20));
  const deliveryTotalPages = Math.max(1, Math.ceil(deliveries.pagination.total / 20));

  const endpointPrev = new URLSearchParams(baseParams);
  endpointPrev.set('endpoint_page', String(Math.max(1, endpointPage - 1)));
  const endpointNext = new URLSearchParams(baseParams);
  endpointNext.set('endpoint_page', String(Math.min(endpointTotalPages, endpointPage + 1)));

  const deliveryPrev = new URLSearchParams(baseParams);
  deliveryPrev.set('delivery_page', String(Math.max(1, deliveryPage - 1)));
  const deliveryNext = new URLSearchParams(baseParams);
  deliveryNext.set('delivery_page', String(Math.min(deliveryTotalPages, deliveryPage + 1)));

  const endpointActiveCount = endpoints.items.filter((item) => item.active).length;
  const deliveryCounts = deliveries.items.reduce(
    (acc, item) => {
      if (item.status === 'success') acc.success += 1;
      if (item.status === 'failed') acc.failed += 1;
      if (item.status === 'pending') acc.pending += 1;
      return acc;
    },
    { success: 0, failed: 0, pending: 0 }
  );

  return (
    <section className="space-y-8">
      <AdminPageHeader
        title="Integrations"
        description="Monitor webhook endpoints, deliveries, and failures."
        icon={<Plug className="h-5 w-5" />}
        badges={
          <>
            <Badge variant="secondary">{endpoints.pagination.total} endpoints</Badge>
            <Badge variant="secondary">{deliveries.pagination.total} deliveries</Badge>
            <Badge variant="secondary">{stats.total_failed} failed 24h</Badge>
          </>
        }
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/app/admin/audit">Audit log</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/app/admin/settings">Settings</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Endpoints</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{endpoints.pagination.total}</div>
            <Badge variant="secondary">{endpointActiveCount} active on page</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Deliveries (page)</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{deliveries.items.length}</div>
            <Badge variant="secondary">{deliveryCounts.pending} pending</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Success (page)</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{deliveryCounts.success}</div>
            <Badge variant="secondary">Success</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Failed (24h)</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{stats.total_failed}</div>
            <Badge variant="secondary">{deliveryCounts.failed} on page</Badge>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <SectionHeader
          icon={<Globe className="h-5 w-5" />}
          title="Webhook endpoints"
          subtitle="Active endpoints receive events in real time."
          badges={
            <>
              <Badge variant="secondary">{endpoints.pagination.total} total</Badge>
              <Badge variant="secondary">{endpointActiveCount} active on page</Badge>
            </>
          }
          actions={
            <AdminHelpTooltip
              label="Endpoint guidance"
              content={
                <div className="space-y-1">
                  <div className="font-medium">Good practices</div>
                  <div>Keep endpoints active and verify secrets after updates.</div>
                  <div>Repeated failures usually indicate URL or network issues.</div>
                </div>
              }
            />
          }
        />

        <Card>
          <CardContent className="space-y-4 pt-6">
            <form>
              <AdminFilters>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="endpoint_q">
                    Search
                  </label>
                  <input
                    id="endpoint_q"
                    name="endpoint_q"
                    defaultValue={endpointQ}
                    placeholder="URL"
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  />
                </div>
                <AdminEntitySelect
                  kind="org"
                  name="endpoint_org_id"
                  label="Organization"
                  placeholder="Search an organization..."
                  defaultValue={endpointOrgId || undefined}
                />
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="endpoint_active">
                    Active
                  </label>
                  <select
                    id="endpoint_active"
                    name="endpoint_active"
                    defaultValue={endpointActive || ''}
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  >
                    <option value="">All</option>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
                <div className="flex items-end gap-2">
                  <Button type="submit" variant="primary">
                    Apply
                  </Button>
                  <Button asChild variant="ghost">
                    <Link href="/app/admin/integrations">Reset</Link>
                  </Button>
                </div>
              </AdminFilters>
            </form>

            <AdminTable>
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Endpoint</th>
                  <th className="px-4 py-3">Organization</th>
                  <th className="px-4 py-3">Active</th>
                  <th className="px-4 py-3">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {endpoints.items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                      No endpoints found.
                    </td>
                  </tr>
                ) : (
                  endpoints.items.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/30">
                      <td className="px-4 py-4">
                        <div className="font-medium">{item.endpoint_url}</div>
                        <div className="text-xs text-muted-foreground">{item.id}</div>
                      </td>
                      <td className="px-4 py-4 text-xs text-muted-foreground">
                        <div>{item.org?.name || '-'}</div>
                        <div>{item.org?.billing_email || item.org_id}</div>
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant={activeVariant(item.active)}>
                          {item.active ? 'active' : 'inactive'}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 text-xs text-muted-foreground">
                        {formatDateTime(item.updated_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </AdminTable>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Page {endpointPage} / {endpointTotalPages}
              </span>
              <div className="flex items-center gap-2">
                {endpointPage <= 1 ? (
                  <span className="px-4 py-2 text-xs text-muted-foreground">Prev</span>
                ) : (
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/app/admin/integrations?${endpointPrev.toString()}`}>Prev</Link>
                  </Button>
                )}
                {endpointPage >= endpointTotalPages ? (
                  <span className="px-4 py-2 text-xs text-muted-foreground">Next</span>
                ) : (
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/app/admin/integrations?${endpointNext.toString()}`}>Next</Link>
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <SectionHeader
          icon={<Inbox className="h-5 w-5" />}
          title="Webhook deliveries"
          subtitle="Inspect delivery status and payloads."
          badges={
            <>
              <Badge variant="secondary">Pending {deliveryCounts.pending}</Badge>
              <Badge variant="secondary">Success {deliveryCounts.success}</Badge>
              <Badge variant="secondary">Failed {deliveryCounts.failed}</Badge>
            </>
          }
        />

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Top errors (24h)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {stats.top.length === 0 ? (
                <div className="text-sm text-muted-foreground">No errors in the last 24 hours.</div>
              ) : (
                stats.top.map((entry) => (
                  <div key={entry.error} className="flex items-start justify-between gap-3">
                    <div className="text-xs text-muted-foreground line-clamp-2">{entry.error}</div>
                    <Badge variant="secondary">{entry.count}</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Quick playbook</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <div>1) Filter failed deliveries and identify the endpoint.</div>
              <div>2) Verify URL, secret, and brand network settings.</div>
              <div>3) Fix and retry from the delivery detail page.</div>
              <div>4) Monitor recovery (success vs pending).</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="space-y-4 pt-6">
            <form>
              <AdminFilters>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="delivery_q">
                    Search
                  </label>
                  <input
                    id="delivery_q"
                    name="delivery_q"
                    defaultValue={deliveryQ}
                    placeholder="Event or error"
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  />
                </div>
                <AdminEntitySelect
                  kind="org"
                  name="delivery_org_id"
                  label="Organization"
                  placeholder="Search an organization..."
                  defaultValue={deliveryOrgId || undefined}
                />
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="delivery_status">
                    Status
                  </label>
                  <select
                    id="delivery_status"
                    name="delivery_status"
                    defaultValue={deliveryStatus || ''}
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  >
                    <option value="">All</option>
                    <option value="pending">Pending</option>
                    <option value="success">Success</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="delivery_event">
                    Event
                  </label>
                  <input
                    id="delivery_event"
                    name="delivery_event"
                    defaultValue={deliveryEvent}
                    placeholder="submission.approved"
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <Button type="submit" variant="primary">
                    Apply
                  </Button>
                  <Button asChild variant="ghost">
                    <Link href="/app/admin/integrations">Reset</Link>
                  </Button>
                </div>
              </AdminFilters>
            </form>

            <AdminTable>
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Delivery</th>
                  <th className="px-4 py-3">Endpoint</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Payload</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {deliveries.items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                      No deliveries found.
                    </td>
                  </tr>
                ) : (
                  deliveries.items.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/30">
                      <td className="px-4 py-4">
                        <div className="font-medium">
                          <Link
                            href={`/app/admin/integrations/deliveries/${item.id}`}
                            className="hover:underline"
                          >
                            {item.event}
                          </Link>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          #{item.id} - retries {item.retry_count}
                        </div>
                        {item.last_error ? (
                          <div className="text-xs text-muted-foreground mt-1">
                            {item.last_error.slice(0, 120)}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 text-xs text-muted-foreground">
                        <div>{item.endpoint?.org?.name || '-'}</div>
                        <div className="truncate max-w-[320px]">
                          {item.endpoint?.endpoint_url || item.endpoint_id}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                      </td>
                      <td className="px-4 py-4">
                        <AdminObjectSummary value={item.payload} />
                      </td>
                      <td className="px-4 py-4 text-xs text-muted-foreground">
                        {formatDateTime(item.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </AdminTable>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Page {deliveryPage} / {deliveryTotalPages}
              </span>
              <div className="flex items-center gap-2">
                {deliveryPage <= 1 ? (
                  <span className="px-4 py-2 text-xs text-muted-foreground">Prev</span>
                ) : (
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/app/admin/integrations?${deliveryPrev.toString()}`}>Prev</Link>
                  </Button>
                )}
                {deliveryPage >= deliveryTotalPages ? (
                  <span className="px-4 py-2 text-xs text-muted-foreground">Next</span>
                ) : (
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/app/admin/integrations?${deliveryNext.toString()}`}>Next</Link>
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
