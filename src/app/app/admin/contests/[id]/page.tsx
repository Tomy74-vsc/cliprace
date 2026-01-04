import Link from 'next/link';
import { fetchAdminApi } from '@/lib/admin/request';
import { notFound, redirect } from 'next/navigation';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminTable } from '@/components/admin/admin-table';
import { AdminContestActions } from '@/components/admin/admin-contest-actions';
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

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="display-2">{data.contest.title}</h1>
            <Badge variant={statusVariant(data.contest.status)}>{data.contest.status}</Badge>
          </div>
          <p className="text-muted-foreground text-sm">{data.contest.slug}</p>
        </div>
        <AdminContestActions
          contestId={data.contest.id}
          status={data.contest.status as 'draft' | 'active' | 'paused' | 'ended' | 'archived'}
          canWrite={canWrite}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Resume</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-6">
              <div>
                <div className="text-muted-foreground text-xs">Dates</div>
                <div>{formatDate(data.contest.start_at)} - {formatDate(data.contest.end_at)}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Brand</div>
                <div>{data.contest.brand?.display_name || data.contest.brand?.email || 'N/A'}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Org</div>
                <div>{data.contest.org?.name || 'Aucune org'}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-6">
              <div>
                <div className="text-muted-foreground text-xs">Budget</div>
                <div>{formatCurrency(data.contest.budget_cents, data.contest.currency)}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Prize pool</div>
                <div>{formatCurrency(data.contest.prize_pool_cents, data.contest.currency)}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Max winners</div>
                <div>{data.contest.max_winners}</div>
              </div>
            </div>
            {data.contest.brief_md ? (
              <div className="text-muted-foreground text-sm">{data.contest.brief_md}</div>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Submissions</span>
              <span className="font-semibold">{data.stats?.total_submissions ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Creators</span>
              <span className="font-semibold">{data.stats?.total_creators ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Approved</span>
              <span className="font-semibold">{data.stats?.approved_submissions ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Views</span>
              <span className="font-semibold">{data.stats?.total_views ?? 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Leaderboard</CardTitle>
        </CardHeader>
        <CardContent>
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
                    Aucun classement disponible
                  </td>
                </tr>
              ) : (
                data.leaderboard.map((row) => (
                  <tr key={row.creator_id}>
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
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Prizes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.prizes.length === 0 ? (
              <p className="text-muted-foreground">Aucun prix défini</p>
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
            <CardTitle>Payments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.payments.length === 0 ? (
              <p className="text-muted-foreground">Aucun paiement enregistré</p>
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
            <CardTitle>Historique des statuts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.status_history.length === 0 ? (
              <p className="text-muted-foreground">Aucune mise à jour</p>
            ) : (
              data.status_history.map((entry) => (
                <div key={entry.id} className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">
                      {entry.old_status || 'none'} → {entry.new_status}
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
            <CardTitle>Audit logs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.audit_logs.length === 0 ? (
              <p className="text-muted-foreground">Aucun log d'audit</p>
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
          <Link href="/app/admin/contests">Back to list</Link>
        </Button>
      </div>
    </section>
  );
}
