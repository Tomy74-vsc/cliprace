import Link from 'next/link';
import { fetchAdminApi } from '@/lib/admin/request';
import { AdminFilters } from '@/components/admin/admin-filters';
import { AdminSubmissionsTable } from '@/components/admin/admin-submissions-table';
import { Button } from '@/components/ui/button';
import { AdminEntitySelect } from '@/components/admin/admin-entity-select';
import { redirect } from 'next/navigation';
import { hasAdminPermission, requireAdminPermission } from '@/lib/admin/rbac';

type SubmissionItem = {
  id: string;
  contest_id: string;
  creator_id: string;
  platform: string;
  external_url: string;
  title: string | null;
  thumbnail_url: string | null;
  status: string;
  rejection_reason: string | null;
  submitted_at: string;
  approved_at: string | null;
  contest: { id: string; title: string } | null;
  creator: { id: string; display_name: string | null; email: string } | null;
  metrics: { views: number; likes: number; comments: number; shares: number };
};

type SubmissionsResponse = {
  items: SubmissionItem[];
  pagination: { total: number; page: number; limit: number };
};

export default async function AdminSubmissionsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  let canWrite = false;
  try {
    const { access } = await requireAdminPermission('submissions.read');
    canWrite = hasAdminPermission(access, 'submissions.write');
  } catch {
    redirect('/forbidden');
  }

  const status = typeof searchParams.status === 'string' ? searchParams.status : '';
  const q = typeof searchParams.q === 'string' ? searchParams.q : '';
  const submissionId = typeof searchParams.submission_id === 'string' ? searchParams.submission_id : '';
  const contestId = typeof searchParams.contest_id === 'string' ? searchParams.contest_id : '';
  const creatorId = typeof searchParams.creator_id === 'string' ? searchParams.creator_id : '';
  const brandId = typeof searchParams.brand_id === 'string' ? searchParams.brand_id : '';
  const page = typeof searchParams.page === 'string' ? Number(searchParams.page) : 1;
  const limit = 20;

  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (q) params.set('q', q);
  if (submissionId) params.set('submission_id', submissionId);
  if (contestId) params.set('contest_id', contestId);
  if (creatorId) params.set('creator_id', creatorId);
  if (brandId) params.set('brand_id', brandId);
  params.set('page', String(page));
  params.set('limit', String(limit));

  const res = await fetchAdminApi(`/api/admin/submissions?${params.toString()}`, {
    cache: 'no-store',
  });

  const data: SubmissionsResponse = res.ok
    ? await res.json()
    : { items: [], pagination: { total: 0, page: 1, limit } };

  const totalPages = Math.max(1, Math.ceil(data.pagination.total / data.pagination.limit));
  const prevHref = `/app/admin/submissions?${new URLSearchParams({
    ...Object.fromEntries(params),
    page: String(Math.max(1, page - 1)),
  }).toString()}`;
  const nextHref = `/app/admin/submissions?${new URLSearchParams({
    ...Object.fromEntries(params),
    page: String(Math.min(totalPages, page + 1)),
  }).toString()}`;

  return (
    <section className="space-y-6">
      <div>
        <h1 className="display-2">Soumissions</h1>
        <p className="text-muted-foreground text-sm">
          {data.pagination.total} soumissions au total
        </p>
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
              placeholder="Titre ou URL"
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="submission_id">
              Soumission
            </label>
            <input
              id="submission_id"
              name="submission_id"
              defaultValue={submissionId}
              placeholder="UUID soumission"
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
              <option value="pending">En attente</option>
              <option value="approved">Approuvée</option>
              <option value="rejected">Rejetée</option>
              <option value="removed">Supprimée</option>
            </select>
          </div>
          <AdminEntitySelect
            kind="contest"
            name="contest_id"
            label="Concours"
            placeholder="Rechercher un concours..."
            defaultValue={contestId || undefined}
          />
          <AdminEntitySelect
            kind="user"
            name="creator_id"
            label="Créateur"
            placeholder="Rechercher un créateur..."
            defaultValue={creatorId || undefined}
          />
          <AdminEntitySelect
            kind="brand"
            name="brand_id"
            label="Marque"
            placeholder="Rechercher une marque..."
            defaultValue={brandId || undefined}
          />
          <div className="flex items-end">
            <Button type="submit" variant="primary">
              Filtrer
            </Button>
          </div>
        </AdminFilters>
      </form>

      <AdminSubmissionsTable submissions={data.items} canWrite={canWrite} />

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

