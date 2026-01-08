import Link from 'next/link';
import { fetchAdminApi } from '@/lib/admin/request';
import { redirect } from 'next/navigation';
import { ListChecks, Trophy } from 'lucide-react';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { AdminFilters } from '@/components/admin/admin-filters';
import { AdminTable } from '@/components/admin/admin-table';
import { AdminEntitySelect } from '@/components/admin/admin-entity-select';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatDate } from '@/lib/formatters';

type ContestListItem = {
  id: string;
  title: string;
  slug: string;
  status: string;
  start_at: string;
  end_at: string;
  prize_pool_cents: number;
  budget_cents: number;
  created_at: string;
  brand_id: string;
  org_id: string | null;
  brand: { id: string; display_name: string | null; email: string } | null;
  org: { id: string; name: string } | null;
  stats: { total_submissions: number; total_views: number };
};

type ContestsResponse = {
  items: ContestListItem[];
  pagination: { total: number; page: number; limit: number };
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

export default async function AdminContestsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  try {
    await requireAdminPermission('contests.read');
  } catch {
    redirect('/forbidden');
  }

  const status = typeof searchParams.status === 'string' ? searchParams.status : '';
  const q = typeof searchParams.q === 'string' ? searchParams.q : '';
  const brandId = typeof searchParams.brand_id === 'string' ? searchParams.brand_id : '';
  const orgId = typeof searchParams.org_id === 'string' ? searchParams.org_id : '';
  const page = typeof searchParams.page === 'string' ? Number(searchParams.page) : 1;
  const limit = 20;

  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (q) params.set('q', q);
  if (brandId) params.set('brand_id', brandId);
  if (orgId) params.set('org_id', orgId);
  params.set('page', String(page));
  params.set('limit', String(limit));

  const res = await fetchAdminApi(`/api/admin/contests?${params.toString()}`, {
    cache: 'no-store',
  });

  const data: ContestsResponse = res.ok
    ? await res.json()
    : { items: [], pagination: { total: 0, page: 1, limit } };

  const totalPages = Math.max(1, Math.ceil(data.pagination.total / data.pagination.limit));

  const prevHref = `/app/admin/contests?${new URLSearchParams({
    ...Object.fromEntries(params),
    page: String(Math.max(1, page - 1)),
  }).toString()}`;
  const nextHref = `/app/admin/contests?${new URLSearchParams({
    ...Object.fromEntries(params),
    page: String(Math.min(totalPages, page + 1)),
  }).toString()}`;

  const statusCounts = data.items.reduce(
    (acc, contest) => {
      if (contest.status === 'active') acc.active += 1;
      else if (contest.status === 'paused') acc.paused += 1;
      else if (contest.status === 'ended') acc.ended += 1;
      else if (contest.status === 'archived') acc.archived += 1;
      else acc.draft += 1;
      return acc;
    },
    { active: 0, paused: 0, ended: 0, archived: 0, draft: 0 }
  );

  const totalSubmissions = data.items.reduce(
    (sum, contest) => sum + (contest.stats?.total_submissions ?? 0),
    0
  );
  const totalViews = data.items.reduce(
    (sum, contest) => sum + (contest.stats?.total_views ?? 0),
    0
  );
  const totalPrizePool = data.items.reduce(
    (sum, contest) => sum + (contest.prize_pool_cents ?? 0),
    0
  );
  const totalBudget = data.items.reduce((sum, contest) => sum + (contest.budget_cents ?? 0), 0);

  return (
    <section className="space-y-8">
      <AdminPageHeader
        title="Contests"
        description="Manage contest schedules, budgets, and performance."
        icon={<Trophy className="h-5 w-5" />}
        badges={
          <>
            <Badge variant="secondary">{data.pagination.total} contests</Badge>
            <Badge variant="secondary">{statusCounts.active} active</Badge>
            <Badge variant="secondary">{statusCounts.draft} draft</Badge>
          </>
        }
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/app/admin/brands">Brands</Link>
            </Button>
            <Button asChild variant="primary">
              <Link href="/app/admin/contests/new">New contest</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Contests total</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{data.pagination.total}</div>
            <Badge variant="secondary">{data.items.length} on page</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Status mix (page)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge variant="secondary">Active {statusCounts.active}</Badge>
            <Badge variant="secondary">Paused {statusCounts.paused}</Badge>
            <Badge variant="secondary">Draft {statusCounts.draft}</Badge>
            <Badge variant="secondary">Ended {statusCounts.ended}</Badge>
            <Badge variant="secondary">Archived {statusCounts.archived}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Prize pool (page)</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{formatCurrency(totalPrizePool, 'EUR')}</div>
            <Badge variant="secondary">Budget {formatCurrency(totalBudget, 'EUR')}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Submissions (page)</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{totalSubmissions}</div>
            <Badge variant="secondary">{totalViews} views</Badge>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <SectionHeader
          icon={<ListChecks className="h-5 w-5" />}
          title="Contest directory"
          subtitle="Search by title, status, brand, or organization."
          badges={
            <>
              <Badge variant="secondary">Active {statusCounts.active}</Badge>
              <Badge variant="secondary">Paused {statusCounts.paused}</Badge>
              <Badge variant="secondary">Ended {statusCounts.ended}</Badge>
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
                    placeholder="Title or slug"
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
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="ended">Ended</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <AdminEntitySelect
                  kind="brand"
                  name="brand_id"
                  label="Brand"
                  placeholder="Search a brand..."
                  defaultValue={brandId || undefined}
                />
                <AdminEntitySelect
                  kind="org"
                  name="org_id"
                  label="Organization"
                  placeholder="Search an organization..."
                  defaultValue={orgId || undefined}
                />
                <div className="flex items-end gap-2">
                  <Button type="submit" variant="primary">
                    Apply
                  </Button>
                  <Button asChild variant="ghost">
                    <Link href="/app/admin/contests">Reset</Link>
                  </Button>
                </div>
              </AdminFilters>
            </form>

            <AdminTable>
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Contest</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Period</th>
                  <th className="px-4 py-3">Brand</th>
                  <th className="px-4 py-3">Prize pool</th>
                  <th className="px-4 py-3">Submissions</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {data.items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                      No contests found.
                    </td>
                  </tr>
                ) : (
                  data.items.map((contest) => (
                    <tr key={contest.id} className="hover:bg-muted/30">
                      <td className="px-4 py-4">
                        <div className="font-medium">{contest.title}</div>
                        <div className="text-xs text-muted-foreground">{contest.slug}</div>
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant={statusVariant(contest.status)}>{contest.status}</Badge>
                      </td>
                      <td className="px-4 py-4 text-xs text-muted-foreground">
                        {formatDate(contest.start_at)} - {formatDate(contest.end_at)}
                      </td>
                      <td className="px-4 py-4 text-xs">
                        <div>{contest.brand?.display_name || contest.brand?.email || 'N/A'}</div>
                        <div className="text-muted-foreground">{contest.org?.name || 'No org'}</div>
                      </td>
                      <td className="px-4 py-4 text-sm">
                        {formatCurrency(contest.prize_pool_cents, 'EUR')}
                      </td>
                      <td className="px-4 py-4 text-sm">
                        <div className="font-medium">{contest.stats.total_submissions}</div>
                        <div className="text-xs text-muted-foreground">
                          {contest.stats.total_views} views
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <Button asChild variant="secondary" size="sm">
                          <Link href={`/app/admin/contests/${contest.id}`}>Details</Link>
                        </Button>
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
