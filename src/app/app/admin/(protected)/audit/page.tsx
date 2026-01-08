
import Link from 'next/link';
import { fetchAdminApi } from '@/lib/admin/request';
import { redirect } from 'next/navigation';
import { Activity, ClipboardList, CreditCard, ListChecks } from 'lucide-react';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { AdminFilters } from '@/components/admin/admin-filters';
import { AdminTable } from '@/components/admin/admin-table';
import { AdminObjectSummary } from '@/components/admin/admin-object-summary';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateTime } from '@/lib/formatters';

type AuditLogItem = {
  id: string;
  actor_id: string | null;
  action: string;
  table_name: string;
  row_pk: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
  actor: { id: string; display_name: string | null; email: string | null } | null;
};

type AuditResponse = {
  items: AuditLogItem[];
  pagination: { total: number; page: number; limit: number };
};

type StatusHistoryItem = {
  id: number;
  table_name: string;
  row_id: string;
  old_status: string | null;
  new_status: string;
  changed_by: string | null;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  actor: { id: string; display_name: string | null; email: string | null } | null;
};

type StatusResponse = {
  items: StatusHistoryItem[];
  pagination: { total: number; page: number; limit: number };
};

type EventLogItem = {
  id: number;
  user_id: string | null;
  org_id: string | null;
  event_name: string;
  properties: Record<string, unknown> | null;
  created_at: string;
  user: { id: string; display_name: string | null; email: string | null } | null;
  org: { id: string; name: string } | null;
};

type EventResponse = {
  items: EventLogItem[];
  pagination: { total: number; page: number; limit: number };
};

type WebhookItem = {
  id: string;
  stripe_event_id: string;
  event_type: string;
  processed: boolean;
  processed_at: string | null;
  created_at: string;
  payload: Record<string, unknown>;
};

type WebhookResponse = {
  items: WebhookItem[];
  pagination: { total: number; page: number; limit: number };
};

function processedVariant(processed: boolean): BadgeProps['variant'] {
  return processed ? 'success' : 'warning';
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
export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  try {
    await requireAdminPermission('audit.read');
  } catch {
    redirect('/forbidden');
  }

  const auditAction = typeof searchParams.audit_action === 'string' ? searchParams.audit_action : '';
  const auditTable = typeof searchParams.audit_table === 'string' ? searchParams.audit_table : '';
  const auditActor = typeof searchParams.audit_actor === 'string' ? searchParams.audit_actor : '';
  const auditQ = typeof searchParams.audit_q === 'string' ? searchParams.audit_q : '';
  const auditPage = typeof searchParams.audit_page === 'string' ? Number(searchParams.audit_page) : 1;

  const statusTable = typeof searchParams.status_table === 'string' ? searchParams.status_table : '';
  const statusNew = typeof searchParams.status_new === 'string' ? searchParams.status_new : '';
  const statusUser = typeof searchParams.status_user === 'string' ? searchParams.status_user : '';
  const statusRow = typeof searchParams.status_row === 'string' ? searchParams.status_row : '';
  const statusQ = typeof searchParams.status_q === 'string' ? searchParams.status_q : '';
  const statusPage = typeof searchParams.status_page === 'string' ? Number(searchParams.status_page) : 1;

  const eventName = typeof searchParams.event_name === 'string' ? searchParams.event_name : '';
  const eventUser = typeof searchParams.event_user === 'string' ? searchParams.event_user : '';
  const eventOrg = typeof searchParams.event_org === 'string' ? searchParams.event_org : '';
  const eventQ = typeof searchParams.event_q === 'string' ? searchParams.event_q : '';
  const eventPage = typeof searchParams.event_page === 'string' ? Number(searchParams.event_page) : 1;

  const webhookEvent = typeof searchParams.webhook_event === 'string' ? searchParams.webhook_event : '';
  const webhookProcessed =
    typeof searchParams.webhook_processed === 'string' ? searchParams.webhook_processed : '';
  const webhookQ = typeof searchParams.webhook_q === 'string' ? searchParams.webhook_q : '';
  const webhookPage =
    typeof searchParams.webhook_page === 'string' ? Number(searchParams.webhook_page) : 1;

  const limit = 20;

  const auditParams = new URLSearchParams();
  if (auditAction) auditParams.set('action', auditAction);
  if (auditTable) auditParams.set('table_name', auditTable);
  if (auditActor) auditParams.set('actor_id', auditActor);
  if (auditQ) auditParams.set('q', auditQ);
  auditParams.set('page', String(auditPage));
  auditParams.set('limit', String(limit));

  const statusParams = new URLSearchParams();
  if (statusTable) statusParams.set('table_name', statusTable);
  if (statusNew) statusParams.set('new_status', statusNew);
  if (statusUser) statusParams.set('changed_by', statusUser);
  if (statusRow) statusParams.set('row_id', statusRow);
  if (statusQ) statusParams.set('q', statusQ);
  statusParams.set('page', String(statusPage));
  statusParams.set('limit', String(limit));

  const eventParams = new URLSearchParams();
  if (eventName) eventParams.set('event_name', eventName);
  if (eventUser) eventParams.set('user_id', eventUser);
  if (eventOrg) eventParams.set('org_id', eventOrg);
  if (eventQ) eventParams.set('q', eventQ);
  eventParams.set('page', String(eventPage));
  eventParams.set('limit', String(limit));

  const webhookParams = new URLSearchParams();
  if (webhookEvent) webhookParams.set('event_type', webhookEvent);
  if (webhookProcessed) webhookParams.set('processed', webhookProcessed);
  if (webhookQ) webhookParams.set('q', webhookQ);
  webhookParams.set('page', String(webhookPage));
  webhookParams.set('limit', String(limit));

  const [auditRes, statusRes, eventRes, webhookRes] = await Promise.all([
    fetchAdminApi(`/api/admin/audit/logs?${auditParams.toString()}`, {
      cache: 'no-store',
    }),
    fetchAdminApi(`/api/admin/audit/status-history?${statusParams.toString()}`, {
      cache: 'no-store',
    }),
    fetchAdminApi(`/api/admin/audit/events?${eventParams.toString()}`, {
      cache: 'no-store',
    }),
    fetchAdminApi(`/api/admin/webhooks/stripe?${webhookParams.toString()}`, {
      cache: 'no-store',
    }),
  ]);

  const auditData: AuditResponse = auditRes.ok
    ? await auditRes.json()
    : { items: [], pagination: { total: 0, page: 1, limit } };
  const statusData: StatusResponse = statusRes.ok
    ? await statusRes.json()
    : { items: [], pagination: { total: 0, page: 1, limit } };
  const eventData: EventResponse = eventRes.ok
    ? await eventRes.json()
    : { items: [], pagination: { total: 0, page: 1, limit } };
  const webhookData: WebhookResponse = webhookRes.ok
    ? await webhookRes.json()
    : { items: [], pagination: { total: 0, page: 1, limit } };

  const auditTotalPages = Math.max(1, Math.ceil(auditData.pagination.total / limit));
  const statusTotalPages = Math.max(1, Math.ceil(statusData.pagination.total / limit));
  const eventTotalPages = Math.max(1, Math.ceil(eventData.pagination.total / limit));
  const webhookTotalPages = Math.max(1, Math.ceil(webhookData.pagination.total / limit));

  const baseParams = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === 'string') baseParams.set(key, value);
  }

  const auditPrev = new URLSearchParams(baseParams);
  auditPrev.set('audit_page', String(Math.max(1, auditPage - 1)));
  const auditNext = new URLSearchParams(baseParams);
  auditNext.set('audit_page', String(Math.min(auditTotalPages, auditPage + 1)));

  const statusPrev = new URLSearchParams(baseParams);
  statusPrev.set('status_page', String(Math.max(1, statusPage - 1)));
  const statusNext = new URLSearchParams(baseParams);
  statusNext.set('status_page', String(Math.min(statusTotalPages, statusPage + 1)));

  const eventPrev = new URLSearchParams(baseParams);
  eventPrev.set('event_page', String(Math.max(1, eventPage - 1)));
  const eventNext = new URLSearchParams(baseParams);
  eventNext.set('event_page', String(Math.min(eventTotalPages, eventPage + 1)));

  const webhookPrev = new URLSearchParams(baseParams);
  webhookPrev.set('webhook_page', String(Math.max(1, webhookPage - 1)));
  const webhookNext = new URLSearchParams(baseParams);
  webhookNext.set('webhook_page', String(Math.min(webhookTotalPages, webhookPage + 1)));

  const auditExportParams = new URLSearchParams(auditParams);
  auditExportParams.set('type', 'audit_logs');
  auditExportParams.set('page', '1');
  auditExportParams.set('limit', '1000');
  const auditExportHref = `/api/admin/audit/export?${auditExportParams.toString()}`;

  const statusExportParams = new URLSearchParams(statusParams);
  statusExportParams.set('type', 'status_history');
  statusExportParams.set('page', '1');
  statusExportParams.set('limit', '1000');
  const statusExportHref = `/api/admin/audit/export?${statusExportParams.toString()}`;

  const eventExportParams = new URLSearchParams(eventParams);
  eventExportParams.set('type', 'event_log');
  eventExportParams.set('page', '1');
  eventExportParams.set('limit', '1000');
  const eventExportHref = `/api/admin/audit/export?${eventExportParams.toString()}`;

  const webhookExportParams = new URLSearchParams(webhookParams);
  webhookExportParams.set('type', 'webhooks_stripe');
  webhookExportParams.set('page', '1');
  webhookExportParams.set('limit', '1000');
  const webhookExportHref = `/api/admin/audit/export?${webhookExportParams.toString()}`;

  const webhookProcessedCount = webhookData.items.filter((item) => item.processed).length;
  const webhookPendingCount = webhookData.items.length - webhookProcessedCount;

  return (
    <section className="space-y-8">
      <AdminPageHeader
        title="Audit and logs"
        description="Audit logs, status history, event log, and Stripe webhooks."
        icon={<ClipboardList className="h-5 w-5" />}
        badges={
          <>
            <Badge variant="secondary">{auditData.pagination.total} audits</Badge>
            <Badge variant="secondary">{statusData.pagination.total} status</Badge>
            <Badge variant="secondary">{eventData.pagination.total} events</Badge>
            <Badge variant="secondary">{webhookData.pagination.total} webhooks</Badge>
          </>
        }
        actions={
          <Button asChild variant="secondary">
            <Link href="/app/admin/exports">Exports</Link>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Audit logs</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{auditData.pagination.total}</div>
            <Badge variant="secondary">{auditData.items.length} on page</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Status history</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{statusData.pagination.total}</div>
            <Badge variant="secondary">{statusData.items.length} on page</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Event log</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{eventData.pagination.total}</div>
            <Badge variant="secondary">{eventData.items.length} on page</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Stripe webhooks</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge variant="secondary">Processed {webhookProcessedCount}</Badge>
            <Badge variant="secondary">Pending {webhookPendingCount}</Badge>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <SectionHeader
          icon={<ClipboardList className="h-5 w-5" />}
          title="Audit logs"
          subtitle="Trace admin actions and data changes."
          actions={
            <Button asChild variant="secondary" size="sm">
              <a href={auditExportHref} target="_blank" rel="noopener noreferrer">
                Export CSV
              </a>
            </Button>
          }
        />
        <Card>
          <CardContent className="space-y-4 pt-6">
            <form>
              <AdminFilters>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="audit_q">
                    Search
                  </label>
                  <input
                    id="audit_q"
                    name="audit_q"
                    defaultValue={auditQ}
                    placeholder="Action, table, row id"
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="audit_table">
                    Table
                  </label>
                  <input
                    id="audit_table"
                    name="audit_table"
                    defaultValue={auditTable}
                    placeholder="Table name"
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="audit_action">
                    Action
                  </label>
                  <input
                    id="audit_action"
                    name="audit_action"
                    defaultValue={auditAction}
                    placeholder="Action"
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="audit_actor">
                    Actor id
                  </label>
                  <input
                    id="audit_actor"
                    name="audit_actor"
                    defaultValue={auditActor}
                    placeholder="User id"
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  />
                </div>
                <div className="flex items-end">
                  <Button type="submit" variant="primary">
                    Apply
                  </Button>
                </div>
              </AdminFilters>
            </form>
            <AdminTable>
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Row</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">IP</th>
                  <th className="px-4 py-3">Changes</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {auditData.items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                      No audit logs found.
                    </td>
                  </tr>
                ) : (
                  auditData.items.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/30">
                      <td className="px-4 py-4">
                        <div className="font-medium">{item.action}</div>
                        <div className="text-xs text-muted-foreground">{item.table_name}</div>
                      </td>
                      <td className="px-4 py-4 text-xs text-muted-foreground">{item.row_pk || '-'}</td>
                      <td className="px-4 py-4 text-xs text-muted-foreground">
                        <div>{item.actor?.display_name || item.actor?.email || 'system'}</div>
                        <div>{item.actor_id || '-'}</div>
                      </td>
                      <td className="px-4 py-4 text-xs text-muted-foreground">{item.ip || '-'}</td>
                      <td className="px-4 py-4 text-xs text-muted-foreground">
                        <div className="space-y-2">
                          <div>
                            <div className="text-[11px] uppercase tracking-wide text-muted-foreground/70">
                              Before
                            </div>
                            <AdminObjectSummary value={item.old_values} />
                          </div>
                          <div>
                            <div className="text-[11px] uppercase tracking-wide text-muted-foreground/70">
                              After
                            </div>
                            <AdminObjectSummary value={item.new_values} />
                          </div>
                        </div>
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
                Page {auditData.pagination.page} / {auditTotalPages}
              </span>
              <div className="flex items-center gap-2">
                {auditPage <= 1 ? (
                  <span className="px-4 py-2 text-xs text-muted-foreground">Prev</span>
                ) : (
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/app/admin/audit?${auditPrev.toString()}`}>Prev</Link>
                  </Button>
                )}
                {auditPage >= auditTotalPages ? (
                  <span className="px-4 py-2 text-xs text-muted-foreground">Next</span>
                ) : (
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/app/admin/audit?${auditNext.toString()}`}>Next</Link>
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="space-y-4">
        <SectionHeader
          icon={<ListChecks className="h-5 w-5" />}
          title="Status history"
          subtitle="Track status changes with reason and actor."
          actions={
            <Button asChild variant="secondary" size="sm">
              <a href={statusExportHref} target="_blank" rel="noopener noreferrer">
                Export CSV
              </a>
            </Button>
          }
        />
        <Card>
          <CardContent className="space-y-4 pt-6">
            <form>
              <AdminFilters>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="status_q">
                    Search
                  </label>
                  <input
                    id="status_q"
                    name="status_q"
                    defaultValue={statusQ}
                    placeholder="Table, status, reason"
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="status_table">
                    Table
                  </label>
                  <input
                    id="status_table"
                    name="status_table"
                    defaultValue={statusTable}
                    placeholder="Table name"
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="status_new">
                    New status
                  </label>
                  <input
                    id="status_new"
                    name="status_new"
                    defaultValue={statusNew}
                    placeholder="New status"
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="status_user">
                    Changed by
                  </label>
                  <input
                    id="status_user"
                    name="status_user"
                    defaultValue={statusUser}
                    placeholder="User id"
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="status_row">
                    Row id
                  </label>
                  <input
                    id="status_row"
                    name="status_row"
                    defaultValue={statusRow}
                    placeholder="Row id"
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  />
                </div>
                <div className="flex items-end">
                  <Button type="submit" variant="primary">
                    Apply
                  </Button>
                </div>
              </AdminFilters>
            </form>
            <AdminTable>
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {statusData.items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                      No history found.
                    </td>
                  </tr>
                ) : (
                  statusData.items.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/30">
                      <td className="px-4 py-4">
                        <div className="font-medium">{item.table_name}</div>
                        <div className="text-xs text-muted-foreground">{item.row_id}</div>
                      </td>
                      <td className="px-4 py-4 text-xs text-muted-foreground">
                        <div>{item.old_status || '-'}</div>
                        <div className="font-medium">{item.new_status}</div>
                      </td>
                      <td className="px-4 py-4 text-xs text-muted-foreground">
                        <div>{item.actor?.display_name || item.actor?.email || 'system'}</div>
                        <div>{item.changed_by || '-'}</div>
                      </td>
                      <td className="px-4 py-4 text-xs text-muted-foreground">{item.reason || '-'}</td>
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
                Page {statusData.pagination.page} / {statusTotalPages}
              </span>
              <div className="flex items-center gap-2">
                {statusPage <= 1 ? (
                  <span className="px-4 py-2 text-xs text-muted-foreground">Prev</span>
                ) : (
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/app/admin/audit?${statusPrev.toString()}`}>Prev</Link>
                  </Button>
                )}
                {statusPage >= statusTotalPages ? (
                  <span className="px-4 py-2 text-xs text-muted-foreground">Next</span>
                ) : (
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/app/admin/audit?${statusNext.toString()}`}>Next</Link>
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="space-y-4">
        <SectionHeader
          icon={<Activity className="h-5 w-5" />}
          title="Event log"
          subtitle="Track key product events across users and orgs."
          actions={
            <Button asChild variant="secondary" size="sm">
              <a href={eventExportHref} target="_blank" rel="noopener noreferrer">
                Export CSV
              </a>
            </Button>
          }
        />
        <Card>
          <CardContent className="space-y-4 pt-6">
            <form>
              <AdminFilters>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="event_q">
                    Search
                  </label>
                  <input
                    id="event_q"
                    name="event_q"
                    defaultValue={eventQ}
                    placeholder="Event name or id"
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="event_name">
                    Event
                  </label>
                  <input
                    id="event_name"
                    name="event_name"
                    defaultValue={eventName}
                    placeholder="Event name"
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="event_user">
                    User id
                  </label>
                  <input
                    id="event_user"
                    name="event_user"
                    defaultValue={eventUser}
                    placeholder="User id"
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="event_org">
                    Org id
                  </label>
                  <input
                    id="event_org"
                    name="event_org"
                    defaultValue={eventOrg}
                    placeholder="Org id"
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  />
                </div>
                <div className="flex items-end">
                  <Button type="submit" variant="primary">
                    Apply
                  </Button>
                </div>
              </AdminFilters>
            </form>
            <AdminTable>
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">User / org</th>
                  <th className="px-4 py-3">Properties</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {eventData.items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                      No events found.
                    </td>
                  </tr>
                ) : (
                  eventData.items.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/30">
                      <td className="px-4 py-4">
                        <div className="font-medium">{item.event_name}</div>
                        <div className="text-xs text-muted-foreground">#{item.id}</div>
                      </td>
                      <td className="px-4 py-4 text-xs text-muted-foreground">
                        <div>{item.user?.display_name || item.user?.email || '-'}</div>
                        <div>{item.org?.name || item.org_id || '-'}</div>
                      </td>
                      <td className="px-4 py-4">
                        <AdminObjectSummary value={item.properties} maxItems={10} />
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
                Page {eventData.pagination.page} / {eventTotalPages}
              </span>
              <div className="flex items-center gap-2">
                {eventPage <= 1 ? (
                  <span className="px-4 py-2 text-xs text-muted-foreground">Prev</span>
                ) : (
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/app/admin/audit?${eventPrev.toString()}`}>Prev</Link>
                  </Button>
                )}
                {eventPage >= eventTotalPages ? (
                  <span className="px-4 py-2 text-xs text-muted-foreground">Next</span>
                ) : (
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/app/admin/audit?${eventNext.toString()}`}>Next</Link>
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <SectionHeader
          icon={<CreditCard className="h-5 w-5" />}
          title="Stripe webhooks"
          subtitle="Inspect webhook delivery and payloads."
          badges={
            <>
              <Badge variant="secondary">Processed {webhookProcessedCount}</Badge>
              <Badge variant="secondary">Pending {webhookPendingCount}</Badge>
            </>
          }
          actions={
            <Button asChild variant="secondary" size="sm">
              <a href={webhookExportHref} target="_blank" rel="noopener noreferrer">
                Export CSV
              </a>
            </Button>
          }
        />
        <Card>
          <CardContent className="space-y-4 pt-6">
            <form>
              <AdminFilters>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="webhook_q">
                    Search
                  </label>
                  <input
                    id="webhook_q"
                    name="webhook_q"
                    defaultValue={webhookQ}
                    placeholder="Event id or type"
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="webhook_event">
                    Event type
                  </label>
                  <input
                    id="webhook_event"
                    name="webhook_event"
                    defaultValue={webhookEvent}
                    placeholder="Event type"
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="webhook_processed">
                    Processed
                  </label>
                  <select
                    id="webhook_processed"
                    name="webhook_processed"
                    defaultValue={webhookProcessed || ''}
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  >
                    <option value="">All</option>
                    <option value="true">Processed</option>
                    <option value="false">Unprocessed</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <Button type="submit" variant="primary">
                    Apply
                  </Button>
                </div>
              </AdminFilters>
            </form>
            <AdminTable>
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Payload</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {webhookData.items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                      No webhooks found.
                    </td>
                  </tr>
                ) : (
                  webhookData.items.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/30">
                      <td className="px-4 py-4">
                        <div className="font-medium">{item.event_type}</div>
                        <div className="text-xs text-muted-foreground">{item.stripe_event_id}</div>
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant={processedVariant(item.processed)}>
                          {item.processed ? 'processed' : 'pending'}
                        </Badge>
                        <div className="text-xs text-muted-foreground mt-1">
                          {item.processed_at ? formatDateTime(item.processed_at) : '-'}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <AdminObjectSummary value={item.payload} maxItems={10} />
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
                Page {webhookData.pagination.page} / {webhookTotalPages}
              </span>
              <div className="flex items-center gap-2">
                {webhookPage <= 1 ? (
                  <span className="px-4 py-2 text-xs text-muted-foreground">Prev</span>
                ) : (
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/app/admin/audit?${webhookPrev.toString()}`}>Prev</Link>
                  </Button>
                )}
                {webhookPage >= webhookTotalPages ? (
                  <span className="px-4 py-2 text-xs text-muted-foreground">Next</span>
                ) : (
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/app/admin/audit?${webhookNext.toString()}`}>Next</Link>
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
