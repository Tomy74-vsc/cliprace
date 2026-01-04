import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Users } from 'lucide-react';

import { fetchAdminApi } from '@/lib/admin/request';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { AdminFiltersBar } from '@/components/admin/admin-filters-bar';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminUsersTableClient, type AdminUserRow } from '@/components/admin/admin-users-table-client';
import { Button } from '@/components/ui/button';

type UsersResponse = {
  items: AdminUserRow[];
  pagination: { total: number; page: number; limit: number };
};

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

  return (
    <section className="space-y-6">
      <AdminPageHeader
        title="Utilisateurs"
        description={`${data.pagination.total.toLocaleString()} utilisateur(s) au total`}
        icon={<Users className="h-5 w-5" />}
      />

      <form>
        <AdminFiltersBar resultsCount={data.pagination.total} resetHref="/app/admin/users">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="q">
              Recherche
            </label>
            <input
              id="q"
              name="q"
              defaultValue={q}
              placeholder="Email, nom, ID"
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="role">
              Rôle
            </label>
            <select
              id="role"
              name="role"
              defaultValue={role || ''}
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
            >
              <option value="">Tous</option>
              <option value="admin">Admin</option>
              <option value="brand">Marque</option>
              <option value="creator">Créateur</option>
            </select>
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
        </AdminFiltersBar>
      </form>

      <AdminUsersTableClient items={data.items} />

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

