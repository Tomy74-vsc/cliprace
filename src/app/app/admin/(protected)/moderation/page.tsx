import Link from 'next/link';
import { fetchAdminApi } from '@/lib/admin/request';
import { redirect } from 'next/navigation';
import { ClipboardList, ListChecks, ScrollText, Shield } from 'lucide-react';
import { hasAdminPermission, requireAdminPermission } from '@/lib/admin/rbac';
import { AdminFilters } from '@/components/admin/admin-filters';
import { AdminModerationQueue } from '@/components/admin/admin-moderation-queue';
import { AdminModerationRules } from '@/components/admin/admin-moderation-rules';
import { AdminTable } from '@/components/admin/admin-table';
import { AdminHelpTooltip } from '@/components/admin/admin-help-tooltip';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateTime } from '@/lib/formatters';

type QueueItem = {
  id: string;
  submission_id: string;
  reason: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  locked_by_me: boolean;
  reviewer: { id: string; display_name: string | null; email: string } | null;
  submission: {
    id: string;
    contest_id: string;
    creator_id: string;
    external_url: string;
    title: string | null;
    thumbnail_url: string | null;
    status: string;
    submitted_at: string;
    contest: { id: string; title: string } | null;
    creator: { id: string; display_name: string | null; email: string } | null;
  } | null;
  metrics: { views: number; likes: number; comments: number; shares: number };
};

type QueueResponse = {
  items: QueueItem[];
  pagination: { total: number; page: number; limit: number };
};

type Rule = {
  id: string;
  name: string;
  description: string | null;
  rule_type: 'content' | 'spam' | 'duplicate' | 'domain' | 'flood';
  config: Record<string, unknown>;
  status?: 'draft' | 'published';
  version?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type RulesResponse = { items: Rule[] };

type HistoryItem = {
  id: number;
  target_table: string;
  target_id: string;
  action: string;
  reason: string | null;
  actor_id: string | null;
  created_at: string;
  actor: { id: string; display_name: string | null; email: string } | null;
};

type HistoryResponse = {
  items: HistoryItem[];
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

export default async function AdminModerationPage({
  searchParams = {},
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  let canWrite = false;
  try {
    const { access } = await requireAdminPermission('moderation.read');
    canWrite = hasAdminPermission(access, 'moderation.write');
  } catch {
    redirect('/forbidden');
  }

  const status = typeof searchParams.status === 'string' ? searchParams.status : '';
  const page = typeof searchParams.page === 'string' ? Number(searchParams.page) : 1;
  const limit = 20;

  const params = new URLSearchParams();
  if (status) params.set('status', status);
  params.set('page', String(page));
  params.set('limit', String(limit));

  const [queueRes, rulesRes, historyRes] = await Promise.all([
    fetchAdminApi(`/api/admin/moderation/queue?${params.toString()}`, {
      cache: 'no-store',
    }),
    fetchAdminApi('/api/admin/moderation/rules', {
      cache: 'no-store',
    }),
    fetchAdminApi('/api/admin/moderation/history?limit=20&page=1', {
      cache: 'no-store',
    }),
  ]);

  const queueData: QueueResponse = queueRes.ok
    ? await queueRes.json()
    : { items: [], pagination: { total: 0, page: 1, limit } };
  const rulesData: RulesResponse = rulesRes.ok ? await rulesRes.json() : { items: [] };
  const historyData: HistoryResponse = historyRes.ok
    ? await historyRes.json()
    : { items: [], pagination: { total: 0, page: 1, limit: 20 } };

  const totalPages = Math.max(1, Math.ceil(queueData.pagination.total / queueData.pagination.limit));
  const prevHref = `/app/admin/moderation?${new URLSearchParams({
    ...Object.fromEntries(params),
    page: String(Math.max(1, page - 1)),
  }).toString()}`;
  const nextHref = `/app/admin/moderation?${new URLSearchParams({
    ...Object.fromEntries(params),
    page: String(Math.min(totalPages, page + 1)),
  }).toString()}`;
  const pageItems = queueData.items.length;
  const activeRules = rulesData.items.filter((rule) => rule.is_active).length;
  const statusCounts = queueData.items.reduce(
    (acc, item) => {
      if (item.status === 'pending') acc.pending += 1;
      else if (item.status === 'processing') acc.processing += 1;
      else if (item.status === 'completed') acc.completed += 1;
      else if (item.status === 'failed') acc.failed += 1;
      return acc;
    },
    { pending: 0, processing: 0, completed: 0, failed: 0 }
  );

  return (
    <section className="space-y-8">
      <AdminPageHeader
        title="Moderation"
        description="Review queue, automated rules, and decision history."
        icon={<Shield className="h-5 w-5" />}
        badges={
          <>
            <Badge variant="secondary">{queueData.pagination.total} in queue</Badge>
            <Badge variant="secondary">{activeRules} active rules</Badge>
          </>
        }
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/app/admin/inbox?kind=ops">Inbox</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/app/admin/guide">Playbooks</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Queue total</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{queueData.pagination.total.toLocaleString()}</div>
            <Badge variant="secondary">{pageItems.toLocaleString()} on page</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active rules</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{activeRules.toLocaleString()}</div>
            <Badge variant="secondary">{rulesData.items.length.toLocaleString()} total</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">History</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{historyData.items.length.toLocaleString()}</div>
            <Badge variant="secondary">Latest 20</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Status mix (page)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge variant="secondary">Pending {statusCounts.pending}</Badge>
            <Badge variant="secondary">Processing {statusCounts.processing}</Badge>
            <Badge variant="secondary">Completed {statusCounts.completed}</Badge>
            <Badge variant="secondary">Failed {statusCounts.failed}</Badge>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <SectionHeader
          icon={<ClipboardList className="h-5 w-5" />}
          title="Queue"
          subtitle="Assign, review, and resolve submissions."
          badges={
            <>
              <Badge variant="secondary">Pending {statusCounts.pending}</Badge>
              <Badge variant="secondary">Processing {statusCounts.processing}</Badge>
              <Badge variant="secondary">Completed {statusCounts.completed}</Badge>
              <Badge variant="secondary">Failed {statusCounts.failed}</Badge>
            </>
          }
          actions={
            <AdminHelpTooltip
              label="Queue workflow"
              content={
                <div className="space-y-1">
                  <div className="font-medium">Workflow</div>
                  <div>Assign an item to yourself, review it, then take a decision.</div>
                  <div>Actions are logged for audit.</div>
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
                    <option value="pending">Pending</option>
                    <option value="processing">Processing</option>
                    <option value="completed">Completed</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
                <div className="flex items-end gap-2">
                  <Button type="submit" variant="primary">
                    Apply
                  </Button>
                  <Button asChild variant="ghost">
                    <Link href="/app/admin/moderation">Reset</Link>
                  </Button>
                </div>
              </AdminFilters>
            </form>

            <AdminModerationQueue items={queueData.items} canWrite={canWrite} />

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Page {queueData.pagination.page} / {totalPages}
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
      <div className="space-y-4">
        <SectionHeader
          icon={<ListChecks className="h-5 w-5" />}
          title="Rules"
          subtitle="Automated filters and enforcement logic."
          badges={
            <>
              <Badge variant="secondary">{activeRules} active</Badge>
              <Badge variant="secondary">{rulesData.items.length} total</Badge>
            </>
          }
          actions={
            <AdminHelpTooltip
              label="Rules help"
              content={
                <div className="space-y-1">
                  <div className="font-medium">Guidance</div>
                  <div>Test rules in read-only mode first, then publish with a clear reason.</div>
                  <div>Every change is logged for audit.</div>
                </div>
              }
            />
          }
        />
        <Card>
          <CardContent className="pt-6">
            <AdminModerationRules rules={rulesData.items} canWrite={canWrite} />
          </CardContent>
        </Card>
      </div>
      <div className="space-y-4">
        <SectionHeader
          icon={<ScrollText className="h-5 w-5" />}
          title="History"
          subtitle="Recent moderation actions and reasons."
          badges={<Badge variant="secondary">{historyData.items.length} items</Badge>}
        />
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <AdminTable>
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Target</th>
                    <th className="px-4 py-3">Actor</th>
                    <th className="px-4 py-3">Reason</th>
                    <th className="px-4 py-3">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-sm">
                  {historyData.items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                        No moderation history yet.
                      </td>
                    </tr>
                  ) : (
                    historyData.items.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/30">
                        <td className="px-4 py-4">
                          <div className="font-medium">{item.action}</div>
                          <div className="text-xs text-muted-foreground">{item.target_table}</div>
                        </td>
                        <td className="px-4 py-4 text-xs text-muted-foreground">{item.target_id}</td>
                        <td className="px-4 py-4">
                          <div className="font-medium">
                            {item.actor?.display_name || item.actor?.email || item.actor_id || 'system'}
                          </div>
                          <div className="text-xs text-muted-foreground">{item.actor_id || '-'}</div>
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
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
