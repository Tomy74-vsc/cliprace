import Link from 'next/link';
import { fetchAdminApi } from '@/lib/admin/request';
import { redirect } from 'next/navigation';
import { FileText, Inbox, Mail, ScrollText, Send } from 'lucide-react';
import { AdminEmailDispatch } from '@/components/admin/admin-email-dispatch';
import { AdminFilters } from '@/components/admin/admin-filters';
import { AdminNotificationTemplates } from '@/components/admin/admin-notification-templates';
import { AdminTable } from '@/components/admin/admin-table';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateTime } from '@/lib/formatters';
import { hasAdminPermission, requireAdminPermission } from '@/lib/admin/rbac';

type Template = {
  id: string;
  event_type: string;
  channel: string;
  subject: string | null;
  body_html: string | null;
  body_text: string | null;
  variables: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type TemplatesResponse = {
  items: Template[];
  pagination: { total: number; page: number; limit: number };
};

type OutboxItem = {
  id: string;
  template_id: string | null;
  user_id: string | null;
  to_email: string | null;
  subject: string | null;
  status: string;
  provider: string | null;
  error_message: string | null;
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
  template: { id: string; event_type: string; channel: string } | null;
  user: { id: string; display_name: string | null; email: string | null } | null;
};

type OutboxResponse = {
  items: OutboxItem[];
  pagination: { total: number; page: number; limit: number };
};

type LogItem = {
  id: string;
  outbox_id: string | null;
  status: string;
  provider: string | null;
  provider_message_id: string | null;
  error_message: string | null;
  created_at: string;
};

type LogsResponse = {
  items: LogItem[];
  pagination: { total: number; page: number; limit: number };
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

function outboxStatusVariant(status: string): BadgeProps['variant'] {
  if (status === 'sent') return 'success';
  if (status === 'failed') return 'danger';
  if (status === 'queued') return 'warning';
  return 'default';
}

function logStatusVariant(status: string): BadgeProps['variant'] {
  if (status === 'sent') return 'success';
  if (status === 'failed') return 'danger';
  return 'default';
}

export default async function AdminEmailsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  let canWrite = false;
  try {
    const { access } = await requireAdminPermission('emails.read');
    canWrite = hasAdminPermission(access, 'emails.write');
  } catch {
    redirect('/forbidden');
  }

  const templateChannel =
    typeof searchParams.template_channel === 'string' ? searchParams.template_channel : '';
  const templateQ = typeof searchParams.template_q === 'string' ? searchParams.template_q : '';
  const templateActive =
    typeof searchParams.template_active === 'string' ? searchParams.template_active : '';

  const outboxStatus =
    typeof searchParams.outbox_status === 'string' ? searchParams.outbox_status : 'queued';
  const outboxQ = typeof searchParams.outbox_q === 'string' ? searchParams.outbox_q : '';
  const outboxPage =
    typeof searchParams.outbox_page === 'string' ? Number(searchParams.outbox_page) : 1;
  const outboxLimit = 20;

  const logStatus = typeof searchParams.log_status === 'string' ? searchParams.log_status : '';
  const logPage = typeof searchParams.log_page === 'string' ? Number(searchParams.log_page) : 1;
  const logLimit = 20;

  const templateParams = new URLSearchParams();
  if (templateChannel) templateParams.set('channel', templateChannel);
  if (templateQ) templateParams.set('q', templateQ);
  if (templateActive) templateParams.set('is_active', templateActive);
  templateParams.set('page', '1');
  templateParams.set('limit', '50');

  const outboxParams = new URLSearchParams();
  if (outboxStatus) outboxParams.set('status', outboxStatus);
  if (outboxQ) outboxParams.set('q', outboxQ);
  outboxParams.set('page', String(outboxPage));
  outboxParams.set('limit', String(outboxLimit));

  const logParams = new URLSearchParams();
  if (logStatus) logParams.set('status', logStatus);
  logParams.set('page', String(logPage));
  logParams.set('limit', String(logLimit));

  const [templatesRes, outboxRes, logsRes] = await Promise.all([
    fetchAdminApi(`/api/admin/notification-templates?${templateParams.toString()}`, {
      cache: 'no-store',
    }),
    fetchAdminApi(`/api/admin/email-outbox?${outboxParams.toString()}`, {
      cache: 'no-store',
    }),
    fetchAdminApi(`/api/admin/email-logs?${logParams.toString()}`, {
      cache: 'no-store',
    }),
  ]);

  const templatesData: TemplatesResponse = templatesRes.ok
    ? await templatesRes.json()
    : { items: [], pagination: { total: 0, page: 1, limit: 50 } };
  const outboxData: OutboxResponse = outboxRes.ok
    ? await outboxRes.json()
    : { items: [], pagination: { total: 0, page: 1, limit: outboxLimit } };
  const logsData: LogsResponse = logsRes.ok
    ? await logsRes.json()
    : { items: [], pagination: { total: 0, page: 1, limit: logLimit } };

  const totalOutboxPages = Math.max(
    1,
    Math.ceil(outboxData.pagination.total / outboxData.pagination.limit)
  );
  const totalLogPages = Math.max(
    1,
    Math.ceil(logsData.pagination.total / logsData.pagination.limit)
  );

  const baseParams = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === 'string') baseParams.set(key, value);
  }

  const outboxPrev = new URLSearchParams(baseParams);
  outboxPrev.set('outbox_page', String(Math.max(1, outboxPage - 1)));
  const outboxNext = new URLSearchParams(baseParams);
  outboxNext.set('outbox_page', String(Math.min(totalOutboxPages, outboxPage + 1)));

  const logPrev = new URLSearchParams(baseParams);
  logPrev.set('log_page', String(Math.max(1, logPage - 1)));
  const logNext = new URLSearchParams(baseParams);
  logNext.set('log_page', String(Math.min(totalLogPages, logPage + 1)));

  const activeTemplates = templatesData.items.filter((template) => template.is_active).length;
  const emailTemplates = templatesData.items.filter((template) => template.channel === 'email').length;
  const outboxCounts = outboxData.items.reduce(
    (acc, item) => {
      if (item.status === 'queued') acc.queued += 1;
      if (item.status === 'sent') acc.sent += 1;
      if (item.status === 'failed') acc.failed += 1;
      return acc;
    },
    { queued: 0, sent: 0, failed: 0 }
  );
  const logCounts = logsData.items.reduce(
    (acc, item) => {
      if (item.status === 'sent') acc.sent += 1;
      if (item.status === 'failed') acc.failed += 1;
      return acc;
    },
    { sent: 0, failed: 0 }
  );

  return (
    <section className="space-y-8">
      <AdminPageHeader
        title="Emails & notifications"
        description="Design templates, dispatch messages, and monitor delivery."
        icon={<Mail className="h-5 w-5" />}
        badges={
          <>
            <Badge variant="secondary">{templatesData.pagination.total} templates</Badge>
            <Badge variant="secondary">{outboxData.pagination.total} outbox</Badge>
            <Badge variant="secondary">{logsData.pagination.total} logs</Badge>
          </>
        }
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/app/admin/integrations">Integrations</Link>
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Templates</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{templatesData.pagination.total.toLocaleString()}</div>
            <Badge variant="secondary">{activeTemplates} active on page</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Outbox queued</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{outboxCounts.queued.toLocaleString()}</div>
            <Badge variant="secondary">{outboxData.items.length} on page</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Outbox sent</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{outboxCounts.sent.toLocaleString()}</div>
            <Badge variant="secondary">{emailTemplates} email templates</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Failures</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <div className="text-2xl font-semibold">
              {(outboxCounts.failed + logCounts.failed).toLocaleString()}
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Outbox {outboxCounts.failed}</Badge>
              <Badge variant="secondary">Logs {logCounts.failed}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <SectionHeader
          icon={<FileText className="h-5 w-5" />}
          title="Templates"
          subtitle="Create, test, and activate notification templates."
          badges={
            <>
              <Badge variant="secondary">Active {activeTemplates}</Badge>
              <Badge variant="secondary">Email {emailTemplates}</Badge>
            </>
          }
        />
        <Card>
          <CardContent className="space-y-4 pt-6">
            <form>
              <AdminFilters>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="template_q">
                    Search
                  </label>
                  <input
                    id="template_q"
                    name="template_q"
                    defaultValue={templateQ}
                    placeholder="Event type"
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label
                    className="text-xs font-medium text-muted-foreground"
                    htmlFor="template_channel"
                  >
                    Channel
                  </label>
                  <select
                    id="template_channel"
                    name="template_channel"
                    defaultValue={templateChannel || ''}
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  >
                    <option value="">All</option>
                    <option value="email">Email</option>
                    <option value="push">Push</option>
                    <option value="inapp">In-app</option>
                    <option value="sms">SMS</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label
                    className="text-xs font-medium text-muted-foreground"
                    htmlFor="template_active"
                  >
                    Active
                  </label>
                  <select
                    id="template_active"
                    name="template_active"
                    defaultValue={templateActive || ''}
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
                    <Link href="/app/admin/emails">Reset</Link>
                  </Button>
                </div>
              </AdminFilters>
            </form>
            <AdminNotificationTemplates templates={templatesData.items} canWrite={canWrite} />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <SectionHeader
          icon={<Send className="h-5 w-5" />}
          title="Dispatch"
          subtitle="Send manual emails or launch a quick segment campaign."
        />
        <AdminEmailDispatch templates={templatesData.items} canWrite={canWrite} />
      </div>

      <div className="space-y-4">
        <SectionHeader
          icon={<Inbox className="h-5 w-5" />}
          title="Email outbox"
          subtitle="Monitor queued and sent messages."
          badges={
            <>
              <Badge variant="secondary">Queued {outboxCounts.queued}</Badge>
              <Badge variant="secondary">Sent {outboxCounts.sent}</Badge>
              <Badge variant="secondary">Failed {outboxCounts.failed}</Badge>
            </>
          }
        />
        <Card>
          <CardContent className="space-y-4 pt-6">
            <form>
              <AdminFilters>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="outbox_q">
                    Search
                  </label>
                  <input
                    id="outbox_q"
                    name="outbox_q"
                    defaultValue={outboxQ}
                    placeholder="Email, subject, user id"
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="outbox_status">
                    Status
                  </label>
                  <select
                    id="outbox_status"
                    name="outbox_status"
                    defaultValue={outboxStatus || ''}
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  >
                    <option value="">All</option>
                    <option value="queued">Queued</option>
                    <option value="sent">Sent</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
                <div className="flex items-end gap-2">
                  <Button type="submit" variant="primary">
                    Apply
                  </Button>
                  <Button asChild variant="ghost">
                    <Link href="/app/admin/emails">Reset</Link>
                  </Button>
                </div>
              </AdminFilters>
            </form>

            <AdminTable>
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Recipient</th>
                  <th className="px-4 py-3">Template</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Schedule</th>
                  <th className="px-4 py-3">Sent</th>
                  <th className="px-4 py-3">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {outboxData.items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                      No outbox messages found.
                    </td>
                  </tr>
                ) : (
                  outboxData.items.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/30">
                      <td className="px-4 py-4">
                        <div className="font-medium">
                          {item.user?.display_name || item.user?.email || item.to_email || 'unknown'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {item.to_email || item.user_id || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-xs text-muted-foreground">
                        {item.template?.event_type || '-'}
                      </td>
                      <td className="px-4 py-4 text-xs text-muted-foreground">
                        {item.subject || '-'}
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant={outboxStatusVariant(item.status)}>{item.status}</Badge>
                      </td>
                      <td className="px-4 py-4 text-xs text-muted-foreground">
                        {item.scheduled_at ? formatDateTime(item.scheduled_at) : '-'}
                      </td>
                      <td className="px-4 py-4 text-xs text-muted-foreground">
                        {item.sent_at ? formatDateTime(item.sent_at) : '-'}
                      </td>
                      <td className="px-4 py-4 text-xs text-muted-foreground">
                        {item.error_message || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </AdminTable>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Page {outboxData.pagination.page} / {totalOutboxPages}
              </span>
              <div className="flex items-center gap-2">
                {outboxPage <= 1 ? (
                  <span className="px-4 py-2 text-xs text-muted-foreground">Prev</span>
                ) : (
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/app/admin/emails?${outboxPrev.toString()}`}>Prev</Link>
                  </Button>
                )}
                {outboxPage >= totalOutboxPages ? (
                  <span className="px-4 py-2 text-xs text-muted-foreground">Next</span>
                ) : (
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/app/admin/emails?${outboxNext.toString()}`}>Next</Link>
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <SectionHeader
          icon={<ScrollText className="h-5 w-5" />}
          title="Delivery logs"
          subtitle="Provider responses and error trail."
          badges={
            <>
              <Badge variant="secondary">Sent {logCounts.sent}</Badge>
              <Badge variant="secondary">Failed {logCounts.failed}</Badge>
            </>
          }
        />
        <Card>
          <CardContent className="space-y-4 pt-6">
            <form>
              <AdminFilters>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="log_status">
                    Status
                  </label>
                  <select
                    id="log_status"
                    name="log_status"
                    defaultValue={logStatus || ''}
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  >
                    <option value="">All</option>
                    <option value="sent">Sent</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
                <div className="flex items-end gap-2">
                  <Button type="submit" variant="primary">
                    Apply
                  </Button>
                  <Button asChild variant="ghost">
                    <Link href="/app/admin/emails">Reset</Link>
                  </Button>
                </div>
              </AdminFilters>
            </form>
            <AdminTable>
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Message</th>
                  <th className="px-4 py-3">Outbox</th>
                  <th className="px-4 py-3">Error</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {logsData.items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                      No logs found.
                    </td>
                  </tr>
                ) : (
                  logsData.items.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/30">
                      <td className="px-4 py-4">
                        <Badge variant={logStatusVariant(log.status)}>{log.status}</Badge>
                      </td>
                      <td className="px-4 py-4 text-xs text-muted-foreground">{log.provider || '-'}</td>
                      <td className="px-4 py-4 text-xs text-muted-foreground">
                        {log.provider_message_id || '-'}
                      </td>
                      <td className="px-4 py-4 text-xs text-muted-foreground">{log.outbox_id || '-'}</td>
                      <td className="px-4 py-4 text-xs text-muted-foreground">{log.error_message || '-'}</td>
                      <td className="px-4 py-4 text-xs text-muted-foreground">
                        {formatDateTime(log.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </AdminTable>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Page {logsData.pagination.page} / {totalLogPages}
              </span>
              <div className="flex items-center gap-2">
                {logPage <= 1 ? (
                  <span className="px-4 py-2 text-xs text-muted-foreground">Prev</span>
                ) : (
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/app/admin/emails?${logPrev.toString()}`}>Prev</Link>
                  </Button>
                )}
                {logPage >= totalLogPages ? (
                  <span className="px-4 py-2 text-xs text-muted-foreground">Next</span>
                ) : (
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/app/admin/emails?${logNext.toString()}`}>Next</Link>
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
