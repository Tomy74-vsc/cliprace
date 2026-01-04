import Link from 'next/link';
import { fetchAdminApi } from '@/lib/admin/request';
import { redirect } from 'next/navigation';
import { AdminBrandCreate } from '@/components/admin/admin-brand-create';
import { AdminFilters } from '@/components/admin/admin-filters';
import { AdminTable } from '@/components/admin/admin-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

  return (
    <section className="space-y-6">
      <div>
        <h1 className="display-2">Marques / Orgs</h1>
        <p className="text-muted-foreground text-sm">{data.pagination.total} marques</p>
      </div>

      <AdminBrandCreate canWrite={canWrite} />

      <form>
        <AdminFilters>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="q">
              Recherche
            </label>
            <input
              id="q"
              name="q"
              defaultValue={q}
              placeholder="Email, nom, id"
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="status">
              Statut
            </label>
            <select
              id="status"
              name="status"
              defaultValue={status || ''}
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
            >
              <option value="">Tous</option>
              <option value="active">Actif</option>
              <option value="inactive">Inactif</option>
            </select>
          </div>
          <div className="flex items-end">
            <Button type="submit" variant="primary">
              Filtrer
            </Button>
          </div>
        </AdminFilters>
      </form>

      <AdminTable>
        <thead className="text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Marque</th>
            <th className="px-4 py-3">Organisation(s)</th>
            <th className="px-4 py-3">Statut</th>
            <th className="px-4 py-3">Onboarding</th>
            <th className="px-4 py-3">Créée</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border text-sm">
          {data.items.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                Aucune marque trouvée
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
                      {brand.is_active ? 'actif' : 'inactif'}
                    </Badge>
                  </td>
                  <td className="px-4 py-4 text-xs text-muted-foreground">
                    {brand.onboarding_complete ? 'terminé' : 'en attente'}
                  </td>
                  <td className="px-4 py-4 text-xs text-muted-foreground">
                    {formatDateTime(brand.created_at)}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      {canViewUsers ? (
                        <Button asChild variant="secondary" size="sm">
                          <Link href={`/app/admin/users/${brand.id}`}>Voir profil</Link>
                        </Button>
                      ) : (
                        <Button variant="secondary" size="sm" disabled title="Accès requis: users.read">
                          Voir profil
                        </Button>
                      )}
                      {canCreateContest ? (
                        <Button asChild variant="primary" size="sm">
                          <Link href={contestHref}>Créer concours</Link>
                        </Button>
                      ) : (
                        <Button variant="primary" size="sm" disabled title="Accès requis: contests.write">
                          Créer concours
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
            <span className="px-4 py-2 text-xs text-muted-foreground">Précédent</span>
          ) : (
            <Button asChild variant="secondary" size="sm">
              <Link href={prevHref}>Précédent</Link>
            </Button>
          )}
          {page >= totalPages ? (
            <span className="px-4 py-2 text-xs text-muted-foreground">Suivant</span>
          ) : (
            <Button asChild variant="secondary" size="sm">
              <Link href={nextHref}>Suivant</Link>
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
