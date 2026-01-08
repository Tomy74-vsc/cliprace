import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ListChecks, Users } from 'lucide-react';

import { fetchAdminApi } from '@/lib/admin/request';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { AdminFiltersBar } from '@/components/admin/admin-filters-bar';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminUsersTableClient, type AdminUserRow } from '@/components/admin/admin-users-table-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type UsersResponse = {
  items: AdminUserRow[];
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

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  try {
    await requireAdminPermission('users.read');
  } catch {
    redirect('/forbidden');
  }

  const status = typeof searchParams.status === 'string' ? searchParams.status : '';
  const role = typeof searchParams.role === 'string' ? searchParams.role : '';
  const q = typeof searchParams.q === 'string' ? searchParams.q : '';
  const page = typeof searchParams.page === 'string' ? Number(searchParams.page) : 1;
  const limit = 20;

  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (role) params.set('role', role);
  if (q) params.set('q', q);
  params.set('page', String(page));
  params.set('limit', String(limit));

  const res = await fetchAdminApi(`/api/admin/users?${params.toString()}`, {
    cache: 'no-store',
  });

  const data: UsersResponse = res.ok
    ? await res.json()
    : { items: [], pagination: { total: 0, page: 1, limit } };

  const totalPages = Math.max(1, Math.ceil(data.pagination.total / data.pagination.limit));
  const prevHref = `/app/admin/users?${new URLSearchParams({
    ...Object.fromEntries(params),
    page: String(Math.max(1, page - 1)),
  }).toString()}`;
  const nextHref = `/app/admin/users?${new URLSearchParams({
    ...Object.fromEntries(params),
    page: String(Math.min(totalPages, page + 1)),
  }).toString()}`;

  const activeCount = data.items.filter((user) => user.is_active).length;
  const inactiveCount = data.items.length - activeCount;
  const onboardingCompleteCount = data.items.filter((user) => user.onboarding_complete).length;
  const adminCount = data.items.filter((user) => user.role === 'admin').length;
  const brandCount = data.items.filter((user) => user.role === 'brand').length;
  const creatorCount = data.items.filter((user) => user.role === 'creator').length;

  return (
    <section className="space-y-8">
      <AdminPageHeader
        title="Users"
        description="Search, review, and manage user accounts."
        icon={<Users className="h-5 w-5" />}
        badges={
          <>
            <Badge variant="secondary">{data.pagination.total.toLocaleString()} total</Badge>
            <Badge variant="secondary">{activeCount.toLocaleString()} active (page)</Badge>
            <Badge variant="secondary">{onboardingCompleteCount.toLocaleString()} onboarded</Badge>
          </>
        }
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/app/admin/team">Team</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/app/admin/crm">CRM</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Users total</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{data.pagination.total.toLocaleString()}</div>
            <Badge variant="secondary">{data.items.length.toLocaleString()} on page</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active users</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{activeCount.toLocaleString()}</div>
            <Badge variant="secondary">{inactiveCount.toLocaleString()} inactive (page)</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Roles (page)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge variant="secondary">Admin {adminCount}</Badge>
            <Badge variant="secondary">Brand {brandCount}</Badge>
            <Badge variant="secondary">Creator {creatorCount}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Onboarding</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{onboardingCompleteCount.toLocaleString()}</div>
            <Badge variant="secondary">Complete on page</Badge>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <SectionHeader
          icon={<ListChecks className="h-5 w-5" />}
          title="User directory"
          subtitle="Filter by role, status, or search terms."
          badges={
            <>
              <Badge variant="secondary">Active {activeCount}</Badge>
              <Badge variant="secondary">Inactive {inactiveCount}</Badge>
            </>
          }
        />

        <Card>
          <CardContent className="space-y-4 pt-6">
            <form>
              <AdminFiltersBar resultsCount={data.pagination.total} resetHref="/app/admin/users">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="q">
                    Search
                  </label>
                  <input
                    id="q"
                    name="q"
                    defaultValue={q}
                    placeholder="Email, name, id"
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="role">
                    Role
                  </label>
                  <select
                    id="role"
                    name="role"
                    defaultValue={role || ''}
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  >
                    <option value="">All</option>
                    <option value="admin">Admin</option>
                    <option value="brand">Brand</option>
                    <option value="creator">Creator</option>
                  </select>
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
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <Button type="submit" variant="primary">
                    Apply
                  </Button>
                </div>
              </AdminFiltersBar>
            </form>

            <AdminUsersTableClient items={data.items} />

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
