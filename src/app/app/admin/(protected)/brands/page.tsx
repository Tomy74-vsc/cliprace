import Link from 'next/link';
import { fetchAdminApi } from '@/lib/admin/request';
import { redirect } from 'next/navigation';
import { Building, ListChecks, PlusCircle } from 'lucide-react';
import { AdminBrandCreate } from '@/components/admin/admin-brand-create';
import { AdminFilters } from '@/components/admin/admin-filters';
import { AdminTable } from '@/components/admin/admin-table';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateTime } from '@/lib/formatters';
import { hasAdminPermission, requireAdminPermission } from '@/lib/admin/rbac';

type BrandItem = {
  id: string;
  email: string;
  display_name: string | null;
  is_active: boolean;
  onboarding_complete: boolean;
  created_at: string;
  updated_at: string;
  brand: { user_id: string; company_name: string } | null;
  org_memberships: Array<{
    org_id: string;
    role_in_org: string;
    org: { id: string; name: string | null; billing_email: string | null } | null;
  }>;
};

type BrandsResponse = {
  items: BrandItem[];
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

export default async function AdminBrandsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  let canWrite = false;
  let canCreateContest = false;
  let canViewUsers = false;
  try {
    const { access } = await requireAdminPermission('brands.read');
    canWrite = hasAdminPermission(access, 'brands.write');
    canCreateContest = hasAdminPermission(access, 'contests.write');
    canViewUsers = hasAdminPermission(access, 'users.read');
  } catch {
    redirect('/forbidden');
  }

  const q = typeof searchParams.q === 'string' ? searchParams.q : '';
  const status = typeof searchParams.status === 'string' ? searchParams.status : '';
  const page = typeof searchParams.page === 'string' ? Number(searchParams.page) : 1;
  const limit = 20;

  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (status) params.set('status', status);
  params.set('page', String(page));
  params.set('limit', String(limit));

  const res = await fetchAdminApi(`/api/admin/brands?${params.toString()}`, {
    cache: 'no-store',
  });

  const data: BrandsResponse = res.ok
    ? await res.json()
    : { items: [], pagination: { total: 0, page: 1, limit } };

  const totalPages = Math.max(1, Math.ceil(data.pagination.total / data.pagination.limit));
  const prevHref = `/app/admin/brands?${new URLSearchParams({
    ...Object.fromEntries(params),
    page: String(Math.max(1, page - 1)),
  }).toString()}`;
  const nextHref = `/app/admin/brands?${new URLSearchParams({
    ...Object.fromEntries(params),
    page: String(Math.min(totalPages, page + 1)),
  }).toString()}`;

  const activeCount = data.items.filter((brand) => brand.is_active).length;
  const inactiveCount = data.items.length - activeCount;
  const onboardedCount = data.items.filter((brand) => brand.onboarding_complete).length;
  const orgLinkedCount = data.items.filter((brand) => brand.org_memberships.length > 0).length;

  return (
    <section className="space-y-8">
      <AdminPageHeader
        title="Brands"
        description="Manage brand accounts, organizations, and onboarding."
        icon={<Building className="h-5 w-5" />}
        badges={
          <>
            <Badge variant="secondary">{data.pagination.total} brands</Badge>
            <Badge variant="secondary">{activeCount} active (page)</Badge>
            <Badge variant="secondary">{onboardedCount} onboarded</Badge>
          </>
        }
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/app/admin/contests">Contests</Link>
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Brands total</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{data.pagination.total}</div>
            <Badge variant="secondary">{data.items.length} on page</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active brands</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{activeCount}</div>
            <Badge variant="secondary">{inactiveCount} inactive (page)</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Orgs linked</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{orgLinkedCount}</div>
            <Badge variant="secondary">On page</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Onboarding</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{onboardedCount}</div>
            <Badge variant="secondary">Completed (page)</Badge>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <SectionHeader
          icon={<PlusCircle className="h-5 w-5" />}
          title="Create brand"
          subtitle="Provision a brand owner and optional organization."
          badges={canWrite ? <Badge variant="secondary">Ready</Badge> : <Badge variant="secondary">Read only</Badge>}
        />
        <AdminBrandCreate canWrite={canWrite} />
      </div>

      <div className="space-y-4">
        <SectionHeader
          icon={<ListChecks className="h-5 w-5" />}
          title="Brand directory"
          subtitle="Search by email, company, or status."
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
              <AdminFilters>
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
                <div className="flex items-end gap-2">
                  <Button type="submit" variant="primary">
                    Apply
                  </Button>
                  <Button asChild variant="ghost">
                    <Link href="/app/admin/brands">Reset</Link>
                  </Button>
                </div>
              </AdminFilters>
            </form>

            <AdminTable>
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Brand</th>
                  <th className="px-4 py-3">Organizations</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Onboarding</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {data.items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                      No brands found.
                    </td>
                  </tr>
                ) : (
                  data.items.map((brand) => {
                    const companyName = brand.brand?.company_name || brand.display_name || brand.email;
                    const firstOrg = brand.org_memberships[0]?.org?.name || null;
                    const orgCount = brand.org_memberships.length;
                    const contestHref = `/app/admin/contests/new?brand_id=${encodeURIComponent(brand.id)}`;

                    return (
                      <tr key={brand.id} className="hover:bg-muted/30">
                        <td className="px-4 py-4">
                          <div className="font-medium">{companyName}</div>
                          <div className="text-xs text-muted-foreground">{brand.email}</div>
                          <div className="text-xs text-muted-foreground">{brand.id}</div>
                        </td>
                        <td className="px-4 py-4 text-xs text-muted-foreground">
                          <div>{firstOrg || '-'}</div>
                          {orgCount > 1 ? <div>+{orgCount - 1}</div> : null}
                        </td>
                        <td className="px-4 py-4 text-xs">
                          <Badge variant={brand.is_active ? 'success' : 'danger'}>
                            {brand.is_active ? 'active' : 'inactive'}
                          </Badge>
                        </td>
                        <td className="px-4 py-4 text-xs text-muted-foreground">
                          {brand.onboarding_complete ? 'complete' : 'pending'}
                        </td>
                        <td className="px-4 py-4 text-xs text-muted-foreground">
                          {formatDateTime(brand.created_at)}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            {canViewUsers ? (
                              <Button asChild variant="secondary" size="sm">
                                <Link href={`/app/admin/users/${brand.id}`}>View profile</Link>
                              </Button>
                            ) : (
                              <Button variant="secondary" size="sm" disabled title="Requires users.read">
                                View profile
                              </Button>
                            )}
                            {canCreateContest ? (
                              <Button asChild variant="primary" size="sm">
                                <Link href={contestHref}>Create contest</Link>
                              </Button>
                            ) : (
                              <Button variant="primary" size="sm" disabled title="Requires contests.write">
                                Create contest
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
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
