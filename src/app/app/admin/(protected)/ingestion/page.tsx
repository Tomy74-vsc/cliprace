import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Activity, AlertTriangle, ListChecks, Users } from 'lucide-react';

import { fetchAdminApi } from '@/lib/admin/request';
import { hasAdminPermission, requireAdminPermission } from '@/lib/admin/rbac';
import { AdminFilters } from '@/components/admin/admin-filters';
import { AdminTable } from '@/components/admin/admin-table';
import { AdminObjectSummary } from '@/components/admin/admin-object-summary';
import { AdminIngestionJobActions } from '@/components/admin/admin-ingestion-job-actions';
import { AdminIngestionErrorActions } from '@/components/admin/admin-ingestion-error-actions';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateTime } from '@/lib/formatters';

type PlatformAccount = {
  id: string;
  user_id: string;
  platform: string;
  platform_user_id: string | null;
  handle: string | null;
  created_at: string;
  user: { id: string; display_name: string | null; email: string } | null;
};

type IngestionJob = {
  id: number;
  account_id: string;
  kind: string;
  scheduled_at: string;
  status: string;
  attempts: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  account:
    | {
        id: string;
        user_id: string;
        platform: string;
        handle: string | null;
        user: { id: string; display_name: string | null; email: string } | null;
      }
    | null;
};

type IngestionError = {
  id: number;
  job_id: number;
  error_code: string;
  details: unknown;
  is_resolved?: boolean;
  resolved_at?: string | null;
  created_at: string;
  job: { id: number; account_id: string; kind: string; status: string } | null;
};

type Paged<T> = { items: T[]; pagination: { total: number; page: number; limit: number } };

function statusVariant(status: string): BadgeProps['variant'] {
  if (status === 'succeeded') return 'success';
  if (status === 'failed') return 'danger';
  if (status === 'running') return 'warning';
  if (status === 'queued') return 'secondary';
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

export default async function AdminIngestionPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  let canWrite = false;
  try {
    const { access } = await requireAdminPermission('ingestion.read');
    canWrite = hasAdminPermission(access, 'ingestion.write');
  } catch {
    redirect('/forbidden');
  }

  const accountQ = typeof searchParams.account_q === 'string' ? searchParams.account_q : '';
  const accountPlatform =
    typeof searchParams.account_platform === 'string' ? searchParams.account_platform : '';
  const accountPage =
    typeof searchParams.account_page === 'string' ? Number(searchParams.account_page) : 1;

  const jobQ = typeof searchParams.job_q === 'string' ? searchParams.job_q : '';
  const jobStatus = typeof searchParams.job_status === 'string' ? searchParams.job_status : '';
  const jobPage = typeof searchParams.job_page === 'string' ? Number(searchParams.job_page) : 1;

  const errQ = typeof searchParams.err_q === 'string' ? searchParams.err_q : '';
  const errCode = typeof searchParams.err_code === 'string' ? searchParams.err_code : '';
  const errPage = typeof searchParams.err_page === 'string' ? Number(searchParams.err_page) : 1;

  const accountParams = new URLSearchParams();
  if (accountQ) accountParams.set('q', accountQ);
  if (accountPlatform) accountParams.set('platform', accountPlatform);
  accountParams.set('page', String(accountPage));
  accountParams.set('limit', '20');

  const jobParams = new URLSearchParams();
  if (jobQ) jobParams.set('q', jobQ);
  if (jobStatus) jobParams.set('status', jobStatus);
  jobParams.set('page', String(jobPage));
  jobParams.set('limit', '20');

  const errParams = new URLSearchParams();
  if (errQ) errParams.set('q', errQ);
  if (errCode) errParams.set('error_code', errCode);
  errParams.set('page', String(errPage));
  errParams.set('limit', '20');

  const [accountsRes, jobsRes, errorsRes] = await Promise.all([
    fetchAdminApi(`/api/admin/platform-accounts?${accountParams.toString()}`, { cache: 'no-store' }),
    fetchAdminApi(`/api/admin/ingestion-jobs?${jobParams.toString()}`, { cache: 'no-store' }),
    fetchAdminApi(`/api/admin/ingestion-errors?${errParams.toString()}`, { cache: 'no-store' }),
  ]);

  const accounts: Paged<PlatformAccount> = accountsRes.ok
    ? await accountsRes.json()
    : { items: [], pagination: { total: 0, page: 1, limit: 20 } };
  const jobs: Paged<IngestionJob> = jobsRes.ok
    ? await jobsRes.json()
    : { items: [], pagination: { total: 0, page: 1, limit: 20 } };
  const errors: Paged<IngestionError> = errorsRes.ok
    ? await errorsRes.json()
    : { items: [], pagination: { total: 0, page: 1, limit: 20 } };

  const baseParams = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === 'string') baseParams.set(key, value);
  }

  const accountTotalPages = Math.max(1, Math.ceil(accounts.pagination.total / 20));
  const jobTotalPages = Math.max(1, Math.ceil(jobs.pagination.total / 20));
  const errTotalPages = Math.max(1, Math.ceil(errors.pagination.total / 20));

  const accountPrev = new URLSearchParams(baseParams);
  accountPrev.set('account_page', String(Math.max(1, accountPage - 1)));
  const accountNext = new URLSearchParams(baseParams);
  accountNext.set('account_page', String(Math.min(accountTotalPages, accountPage + 1)));

  const jobPrev = new URLSearchParams(baseParams);
  jobPrev.set('job_page', String(Math.max(1, jobPage - 1)));
  const jobNext = new URLSearchParams(baseParams);
  jobNext.set('job_page', String(Math.min(jobTotalPages, jobPage + 1)));

  const errPrev = new URLSearchParams(baseParams);
  errPrev.set('err_page', String(Math.max(1, errPage - 1)));
  const errNext = new URLSearchParams(baseParams);
  errNext.set('err_page', String(Math.min(errTotalPages, errPage + 1)));

  const platformCounts = accounts.items.reduce(
    (acc, item) => {
      acc[item.platform] = (acc[item.platform] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  const platformTotal = Object.keys(platformCounts).length;

  const jobStatusCounts = jobs.items.reduce(
    (acc, item) => {
      if (item.status === 'failed') acc.failed += 1;
      else if (item.status === 'running') acc.running += 1;
      else if (item.status === 'queued') acc.queued += 1;
      else if (item.status === 'succeeded') acc.succeeded += 1;
      else acc.other += 1;
      return acc;
    },
    { failed: 0, running: 0, queued: 0, succeeded: 0, other: 0 }
  );
  const resolvedErrors = errors.items.filter((item) => item.is_resolved).length;
  const unresolvedErrors = errors.items.length - resolvedErrors;

  return (
    <section className="space-y-8">
      <AdminPageHeader
        title="Ingestion"
        description="Monitor platform accounts, jobs, and the ingestion error inbox."
        icon={<Activity className="h-5 w-5" />}
        badges={
          <>
            <Badge variant="secondary">{accounts.pagination.total} accounts</Badge>
            <Badge variant="secondary">{jobs.pagination.total} jobs</Badge>
            <Badge variant="secondary">{errors.pagination.total} errors</Badge>
            <Badge variant={canWrite ? 'success' : 'secondary'}>
              {canWrite ? 'Write access' : 'Read only'}
            </Badge>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Platform accounts</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{accounts.pagination.total}</div>
            <Badge variant="secondary">{platformTotal} platforms</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Jobs total</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{jobs.pagination.total}</div>
            <Badge variant="secondary">{jobStatusCounts.failed} failed (page)</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Errors total</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{errors.pagination.total}</div>
            <Badge variant="secondary">{unresolvedErrors} unresolved (page)</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Queue status (page)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge variant="secondary">Queued {jobStatusCounts.queued}</Badge>
            <Badge variant="secondary">Running {jobStatusCounts.running}</Badge>
            <Badge variant="secondary">Succeeded {jobStatusCounts.succeeded}</Badge>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <SectionHeader
          icon={<Users className="h-5 w-5" />}
          title="Platform accounts"
          subtitle="Accounts linked for ingestion across platforms."
          badges={
            <>
              <Badge variant="secondary">{accounts.items.length} on page</Badge>
              <Badge variant="secondary">{platformTotal} platforms</Badge>
            </>
          }
        />

        <Card>
          <CardContent className="space-y-4 pt-6">
            <form>
              <AdminFilters>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="account_q">
                    Search
                  </label>
                  <input
                    id="account_q"
                    name="account_q"
                    defaultValue={accountQ}
                    placeholder="Handle or platform user id"
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="account_platform">
                    Platform
                  </label>
                  <select
                    id="account_platform"
                    name="account_platform"
                    defaultValue={accountPlatform || ''}
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  >
                    <option value="">All</option>
                    <option value="tiktok">tiktok</option>
                    <option value="instagram">instagram</option>
                    <option value="youtube">youtube</option>
                    <option value="x">x</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <Button type="submit" variant="primary">
                    Apply
                  </Button>
                </div>
              </AdminFilters>
            </form>

            <AdminTable>
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Account</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {accounts.items.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">
                      No platform accounts found.
                    </td>
                  </tr>
                ) : (
                  accounts.items.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/30">
                      <td className="px-4 py-4">
                        <div className="font-medium">
                          {item.platform} {item.handle ? `@${item.handle}` : '-'}
                        </div>
                        <div className="text-xs text-muted-foreground">{item.platform_user_id || '-'}</div>
                        <div className="text-xs text-muted-foreground">{item.id}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-medium">
                          {item.user?.display_name || item.user?.email || item.user_id}
                        </div>
                        <div className="text-xs text-muted-foreground">{item.user_id}</div>
                        <div className="mt-2">
                          <Button asChild variant="secondary" size="sm">
                            <Link href={`/app/admin/users/${item.user_id}`}>View user</Link>
                          </Button>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-xs text-muted-foreground">
                        {formatDateTime(item.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </AdminTable>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Page {accountPage} / {accountTotalPages}
              </span>
              <div className="flex items-center gap-2">
                {accountPage <= 1 ? (
                  <span className="px-4 py-2 text-xs text-muted-foreground">Prev</span>
                ) : (
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/app/admin/ingestion?${accountPrev.toString()}`}>Prev</Link>
                  </Button>
                )}
                {accountPage >= accountTotalPages ? (
                  <span className="px-4 py-2 text-xs text-muted-foreground">Next</span>
                ) : (
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/app/admin/ingestion?${accountNext.toString()}`}>Next</Link>
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <SectionHeader
          icon={<ListChecks className="h-5 w-5" />}
          title="Ingestion jobs"
          subtitle="Jobs queued or running across platform accounts."
          badges={
            <>
              <Badge variant="secondary">Failed {jobStatusCounts.failed}</Badge>
              <Badge variant="secondary">Running {jobStatusCounts.running}</Badge>
              <Badge variant="secondary">Queued {jobStatusCounts.queued}</Badge>
            </>
          }
        />

        <Card>
          <CardContent className="space-y-4 pt-6">
            <form>
              <AdminFilters>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="job_q">
                    Search
                  </label>
                  <input
                    id="job_q"
                    name="job_q"
                    defaultValue={jobQ}
                    placeholder="Kind or error message"
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="job_status">
                    Status
                  </label>
                  <select
                    id="job_status"
                    name="job_status"
                    defaultValue={jobStatus || ''}
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  >
                    <option value="">All</option>
                    <option value="queued">queued</option>
                    <option value="running">running</option>
                    <option value="succeeded">succeeded</option>
                    <option value="failed">failed</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <Button type="submit" variant="primary">
                    Apply
                  </Button>
                </div>
              </AdminFilters>
            </form>

            <AdminTable>
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Job</th>
                  <th className="px-4 py-3">Account</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Scheduled</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {jobs.items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                      No jobs found.
                    </td>
                  </tr>
                ) : (
                  jobs.items.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/30">
                      <td className="px-4 py-4">
                        <div className="font-medium">{item.kind}</div>
                        <div className="text-xs text-muted-foreground">
                          #{item.id} - Attempts {item.attempts}
                        </div>
                        {item.last_error ? (
                          <div className="text-xs text-muted-foreground mt-1">
                            {item.last_error.slice(0, 120)}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 text-xs text-muted-foreground">
                        <div>{item.account?.platform || '-'}</div>
                        <div>{item.account?.handle ? `@${item.account.handle}` : '-'}</div>
                        <div>{item.account?.user?.email || item.account?.user_id || '-'}</div>
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                      </td>
                      <td className="px-4 py-4 text-xs text-muted-foreground">
                        {formatDateTime(item.scheduled_at)}
                      </td>
                      <td className="px-4 py-4">
                        <AdminIngestionJobActions jobId={item.id} status={item.status} canWrite={canWrite} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </AdminTable>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Page {jobPage} / {jobTotalPages}
              </span>
              <div className="flex items-center gap-2">
                {jobPage <= 1 ? (
                  <span className="px-4 py-2 text-xs text-muted-foreground">Prev</span>
                ) : (
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/app/admin/ingestion?${jobPrev.toString()}`}>Prev</Link>
                  </Button>
                )}
                {jobPage >= jobTotalPages ? (
                  <span className="px-4 py-2 text-xs text-muted-foreground">Next</span>
                ) : (
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/app/admin/ingestion?${jobNext.toString()}`}>Next</Link>
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <SectionHeader
          icon={<AlertTriangle className="h-5 w-5" />}
          title="Ingestion errors"
          subtitle="Error inbox with resolution history and payloads."
          badges={
            <>
              <Badge variant="secondary">Unresolved {unresolvedErrors}</Badge>
              <Badge variant="secondary">Resolved {resolvedErrors}</Badge>
            </>
          }
        />

        <Card>
          <CardContent className="space-y-4 pt-6">
            <form>
              <AdminFilters>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="err_q">
                    Search
                  </label>
                  <input
                    id="err_q"
                    name="err_q"
                    defaultValue={errQ}
                    placeholder="Error code"
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="err_code">
                    Error code
                  </label>
                  <input
                    id="err_code"
                    name="err_code"
                    defaultValue={errCode}
                    placeholder="RATE_LIMIT, API_ERROR..."
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  />
                </div>
                <div className="flex items-end">
                  <Button type="submit" variant="primary">
                    Apply
                  </Button>
                </div>
              </AdminFilters>
            </form>

            <AdminTable>
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Error</th>
                  <th className="px-4 py-3">Job</th>
                  <th className="px-4 py-3">Details</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {errors.items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                      No errors found.
                    </td>
                  </tr>
                ) : (
                  errors.items.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/30">
                      <td className="px-4 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium">{item.error_code}</div>
                            <div className="text-xs text-muted-foreground">#{item.id}</div>
                          </div>
                          <AdminIngestionErrorActions
                            errorId={item.id}
                            isResolved={Boolean(item.is_resolved)}
                            canWrite={canWrite}
                          />
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {item.is_resolved ? (
                            <Badge variant="success">Resolved</Badge>
                          ) : (
                            <Badge variant="warning">Needs review</Badge>
                          )}
                          {item.resolved_at ? (
                            <span className="text-xs text-muted-foreground">
                              {formatDateTime(item.resolved_at)}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-xs text-muted-foreground">
                        <div>Job #{item.job_id}</div>
                        <div>{item.job?.kind || '-'}</div>
                        <div>
                          {item.job?.status ? (
                            <Badge variant={statusVariant(item.job.status)}>{item.job.status}</Badge>
                          ) : (
                            '-'
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <AdminObjectSummary value={item.details} />
                      </td>
                      <td className="px-4 py-4 text-xs text-muted-foreground">
                        {formatDateTime(item.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </AdminTable>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Page {errPage} / {errTotalPages}
              </span>
              <div className="flex items-center gap-2">
                {errPage <= 1 ? (
                  <span className="px-4 py-2 text-xs text-muted-foreground">Prev</span>
                ) : (
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/app/admin/ingestion?${errPrev.toString()}`}>Prev</Link>
                  </Button>
                )}
                {errPage >= errTotalPages ? (
                  <span className="px-4 py-2 text-xs text-muted-foreground">Next</span>
                ) : (
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/app/admin/ingestion?${errNext.toString()}`}>Next</Link>
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
