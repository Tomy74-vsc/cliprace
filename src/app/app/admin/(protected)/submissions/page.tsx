import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Filter, ListChecks, Video } from 'lucide-react';

import { fetchAdminApi } from '@/lib/admin/request';
import { hasAdminPermission, requireAdminPermission } from '@/lib/admin/rbac';

import { AdminFilters } from '@/components/admin/admin-filters';
import { AdminSubmissionsTable } from '@/components/admin/admin-submissions-table';
import { AdminEntitySelect } from '@/components/admin/admin-entity-select';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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

  const pageItems = data.items.length;
  const statusCounts = data.items.reduce(
    (acc, item) => {
      if (item.status === 'pending') acc.pending += 1;
      else if (item.status === 'approved') acc.approved += 1;
      else if (item.status === 'rejected') acc.rejected += 1;
      else if (item.status === 'removed') acc.removed += 1;
      return acc;
    },
    { pending: 0, approved: 0, rejected: 0, removed: 0 }
  );

  return (
    <section className="space-y-6">
      <AdminPageHeader
        title="Submissions"
        description="Track UGC submissions, review status, and quality checks."
        icon={<Video className="h-5 w-5" />}
        badges={<Badge variant="secondary">{data.pagination.total} total</Badge>}
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/app/admin/moderation">Moderation queue</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/app/admin/inbox?kind=ops">Inbox</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{data.pagination.total.toLocaleString()}</div>
            <Badge variant="secondary">{pageItems.toLocaleString()} on page</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{statusCounts.pending.toLocaleString()}</div>
            <Badge variant="secondary">Needs review</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Approved</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{statusCounts.approved.toLocaleString()}</div>
            <Badge variant="secondary">Published</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Rejected / Removed</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <Badge variant="secondary">Rejected {statusCounts.rejected}</Badge>
            <Badge variant="secondary">Removed {statusCounts.removed}</Badge>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <SectionHeader
          icon={<Filter className="h-5 w-5" />}
          title="Filters"
          subtitle="Search by title, URL, contest, creator, or brand."
        />
        <Card>
          <CardContent className="pt-6">
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
                    placeholder="Title or URL"
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="submission_id">
                    Submission ID
                  </label>
                  <input
                    id="submission_id"
                    name="submission_id"
                    defaultValue={submissionId}
                    placeholder="Submission UUID"
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
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="removed">Removed</option>
                  </select>
                </div>
                <AdminEntitySelect
                  kind="contest"
                  name="contest_id"
                  label="Contest"
                  placeholder="Search contest..."
                  defaultValue={contestId || undefined}
                />
                <AdminEntitySelect
                  kind="user"
                  name="creator_id"
                  label="Creator"
                  placeholder="Search creator..."
                  defaultValue={creatorId || undefined}
                />
                <AdminEntitySelect
                  kind="brand"
                  name="brand_id"
                  label="Brand"
                  placeholder="Search brand..."
                  defaultValue={brandId || undefined}
                />
                <div className="flex items-end gap-2">
                  <Button type="submit" variant="primary">
                    Apply
                  </Button>
                  <Button asChild variant="ghost">
                    <Link href="/app/admin/submissions">Reset</Link>
                  </Button>
                </div>
              </AdminFilters>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <SectionHeader
          icon={<ListChecks className="h-5 w-5" />}
          title="Submissions list"
          subtitle="Review, approve, or reject with full context."
          badges={<Badge variant="secondary">{pageItems} on page</Badge>}
        />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              All submissions
              <Badge variant="secondary">{data.pagination.total} total</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <AdminSubmissionsTable submissions={data.items} canWrite={canWrite} />
            </div>
          </CardContent>
        </Card>
      </div>

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
    </section>
  );
}
