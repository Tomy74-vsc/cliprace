import Link from 'next/link';
import { fetchAdminApi } from '@/lib/admin/request';
import { redirect } from 'next/navigation';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { AdminFilters } from '@/components/admin/admin-filters';
import { AdminTable } from '@/components/admin/admin-table';
import { AdminEntitySelect } from '@/components/admin/admin-entity-select';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="display-2">Concours</h1>
          <p className="text-muted-foreground text-sm">
            {data.pagination.total} concours au total
          </p>
        </div>
      </div>

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
              placeholder="Titre ou slug"
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
              <option value="draft">Brouillon</option>
              <option value="active">Actif</option>
              <option value="paused">En pause</option>
              <option value="ended">Terminé</option>
              <option value="archived">Archivé</option>
            </select>
          </div>
          <AdminEntitySelect
            kind="brand"
            name="brand_id"
            label="Marque"
            placeholder="Rechercher une marque..."
            defaultValue={brandId || undefined}
          />
          <AdminEntitySelect
            kind="org"
            name="org_id"
            label="Organisation"
            placeholder="Rechercher une organisation..."
            defaultValue={orgId || undefined}
          />
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
            <th className="px-4 py-3">Concours</th>
            <th className="px-4 py-3">Statut</th>
            <th className="px-4 py-3">Période</th>
            <th className="px-4 py-3">Marque</th>
            <th className="px-4 py-3">Dotation</th>
            <th className="px-4 py-3">Soumissions</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border text-sm">
          {data.items.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                Aucun concours trouve
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
                  <div className="text-muted-foreground">{contest.org?.name || 'Aucune org'}</div>
                </td>
                <td className="px-4 py-4 text-sm">
                  {formatCurrency(contest.prize_pool_cents, 'EUR')}
                </td>
                <td className="px-4 py-4 text-sm">{contest.stats.total_submissions}</td>
                <td className="px-4 py-4">
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/app/admin/contests/${contest.id}`}>Détails</Link>
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

