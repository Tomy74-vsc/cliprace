import Link from 'next/link';
import { fetchAdminApi } from '@/lib/admin/request';
import { notFound, redirect } from 'next/navigation';
import { CreditCard, Gift, ListChecks, ScrollText, ShieldCheck, Trophy } from 'lucide-react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminTable } from '@/components/admin/admin-table';
import { AdminContestActions } from '@/components/admin/admin-contest-actions';
import { AdminViewAsButton } from '@/components/admin/admin-view-as-button';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/formatters';
import { hasAdminPermission, requireAdminPermission } from '@/lib/admin/rbac';

type ContestDetailResponse = {
  contest: {
    id: string;
    title: string;
    slug: string;
    status: string;
    brief_md: string | null;
    cover_url: string | null;
    start_at: string;
    end_at: string;
    budget_cents: number;
    prize_pool_cents: number;
    currency: string;
    max_winners: number;
    brand_id: string;
    org_id: string | null;
    created_at: string;
    updated_at: string;
    brand: { id: string; display_name: string | null; email: string } | null;
    org: { id: string; name: string } | null;
  };
  stats: {
    contest_id: string;
    total_submissions: number;
    total_creators: number;
    approved_submissions: number;
    total_views: number;
    total_likes: number;
    total_comments: number;
    total_shares: number;
    total_weighted_views: number;
  } | null;
  leaderboard: Array<{
    rank: number;
    creator_id: string;
    total_weighted_views: number;
    total_views: number;
    total_likes: number;
    total_comments: number;
    total_shares: number;
    submission_count: number;
    creator: { id: string; display_name: string | null; email: string } | null;
  }>;
  prizes: Array<{ id: string; position: number; percentage: number | null; amount_cents: number | null }>;
  payments: Array<{ id: string; amount_cents: number; currency: string; status: string; created_at: string }>;
  status_history: Array<{
    id: number;
    old_status: string | null;
    new_status: string;
    created_at: string;
    changed_by: string | null;
    reason: string | null;
  }>;
  audit_logs: Array<{ id: string; action: string; created_at: string; actor_id: string | null }>;
};

function statusVariant(status: string): BadgeProps['variant'] {
  if (status === 'active') return 'success';
  if (status === 'paused') return 'warning';
  if (status === 'ended') return 'outline';
  if (status === 'archived') return 'secondary';
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

export default async function AdminContestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let canWrite = false;
  try {
    const { access } = await requireAdminPermission('contests.read');
    canWrite = hasAdminPermission(access, 'contests.write');
  } catch {
    redirect('/forbidden');
  }

  const res = await fetchAdminApi(`/api/admin/contests/${id}`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    notFound();
  }

  const data: ContestDetailResponse = await res.json();
  const stats = data.stats ?? {
    contest_id: data.contest.id,
    total_submissions: 0,
    total_creators: 0,
    approved_submissions: 0,
    total_views: 0,
    total_likes: 0,
    total_comments: 0,
    total_shares: 0,
    total_weighted_views: 0,
  };

  const paymentsTotal = data.payments.reduce((sum, payment) => sum + payment.amount_cents, 0);

  return (
    <section className="space-y-8">
      <AdminPageHeader
        title={data.contest.title}
        description={data.contest.slug}
        icon={<Trophy className="h-5 w-5" />}
        badges={
          <>
            <Badge variant={statusVariant(data.contest.status)}>{data.contest.status}</Badge>
            <Badge variant="secondary">{data.contest.currency}</Badge>
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            {data.contest.brand_id && (
              <AdminViewAsButton userId={data.contest.brand_id} targetRole="brand" />
            )}
            <AdminContestActions
              contestId={data.contest.id}
              status={data.contest.status as 'draft' | 'active' | 'paused' | 'ended' | 'archived'}
              canWrite={canWrite}
            />
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Submissions</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{stats.total_submissions}</div>
            <Badge variant="secondary">{stats.approved_submissions} approved</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Creators</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{stats.total_creators}</div>
            <Badge variant="secondary">Engaged</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Views</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{stats.total_views.toLocaleString()}</div>
            <Badge variant="secondary">Weighted {stats.total_weighted_views.toLocaleString()}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Budget</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">
              {formatCurrency(data.contest.budget_cents, data.contest.currency)}
            </div>
            <Badge variant="secondary">
              Prize {formatCurrency(data.contest.prize_pool_cents, data.contest.currency)}
            </Badge>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <SectionHeader
          icon={<ListChecks className="h-5 w-5" />}
          title="Overview"
          subtitle="Timeline, ownership, and financial targets."
          badges={
            <>
              <Badge variant="secondary">Max winners {data.contest.max_winners}</Badge>
              <Badge variant="secondary">Payments {data.payments.length}</Badge>
            </>
          }
        />

        <Card>
          <CardContent className="space-y-4 pt-6 text-sm">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-xs text-muted-foreground">Dates</div>
                <div>
                  {formatDate(data.contest.start_at)} - {formatDate(data.contest.end_at)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Brand</div>
                <div>{data.contest.brand?.display_name || data.contest.brand?.email || 'N/A'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Organization</div>
                <div>{data.contest.org?.name || 'No organization'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Payments total</div>
                <div>{formatCurrency(paymentsTotal, data.contest.currency)}</div>
              </div>
            </div>
            {data.contest.brief_md ? (
              <div className="text-muted-foreground">{data.contest.brief_md}</div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <SectionHeader
          icon={<Trophy className="h-5 w-5" />}
          title="Leaderboard"
          subtitle="Top creators by weighted views."
        />
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <AdminTable>
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Rank</th>
                    <th className="px-4 py-3">Creator</th>
                    <th className="px-4 py-3">Weighted views</th>
                    <th className="px-4 py-3">Submissions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-sm">
                  {data.leaderboard.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                        No leaderboard data.
                      </td>
                    </tr>
                  ) : (
                    data.leaderboard.map((row) => (
                      <tr key={row.creator_id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-semibold">#{row.rank}</td>
                        <td className="px-4 py-3">
                          {row.creator?.display_name || row.creator?.email || row.creator_id}
                        </td>
                        <td className="px-4 py-3">{row.total_weighted_views.toLocaleString()}</td>
                        <td className="px-4 py-3">{row.submission_count}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </AdminTable>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="h-4 w-4" />
              Prizes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.prizes.length === 0 ? (
              <p className="text-muted-foreground">No prizes configured.</p>
            ) : (
              data.prizes.map((prize) => (
                <div key={prize.id} className="flex items-center justify-between">
                  <span className="text-muted-foreground">#{prize.position}</span>
                  <span className="font-semibold">
                    {prize.amount_cents
                      ? formatCurrency(prize.amount_cents, data.contest.currency)
                      : `${prize.percentage}%`}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Payments
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.payments.length === 0 ? (
              <p className="text-muted-foreground">No payments recorded.</p>
            ) : (
              data.payments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{payment.status}</div>
                    <div className="text-muted-foreground text-xs">{formatDateTime(payment.created_at)}</div>
                  </div>
                  <div className="font-semibold">
                    {formatCurrency(payment.amount_cents, payment.currency)}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ScrollText className="h-4 w-4" />
              Status history
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.status_history.length === 0 ? (
              <p className="text-muted-foreground">No status changes recorded.</p>
            ) : (
              data.status_history.map((entry) => (
                <div key={entry.id} className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">
                      {entry.old_status || 'none'} {'→'} {entry.new_status}
                    </div>
                    {entry.reason ? (
                      <div className="text-xs text-muted-foreground">{entry.reason}</div>
                    ) : null}
                  </div>
                  <div className="text-xs text-muted-foreground">{formatDateTime(entry.created_at)}</div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              Audit log
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.audit_logs.length === 0 ? (
              <p className="text-muted-foreground">No audit logs.</p>
            ) : (
              data.audit_logs.map((entry) => (
                <div key={entry.id} className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{entry.action}</div>
                    <div className="text-xs text-muted-foreground">{entry.actor_id || 'system'}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">{formatDateTime(entry.created_at)}</div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-3">
        <Button asChild variant="secondary">
          <Link href="/app/admin/contests">Back to contests</Link>
        </Button>
      </div>
    </section>
  );
}
