import Link from 'next/link';
import { fetchAdminApi } from '@/lib/admin/request';
import { redirect } from 'next/navigation';
import { hasAdminPermission, requireAdminPermission } from '@/lib/admin/rbac';
import { AdminFilters } from '@/components/admin/admin-filters';
import { AdminTable } from '@/components/admin/admin-table';
import { AdminObjectSummary } from '@/components/admin/admin-object-summary';
import { AdminIngestionJobActions } from '@/components/admin/admin-ingestion-job-actions';
import { AdminIngestionErrorActions } from '@/components/admin/admin-ingestion-error-actions';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

  const accountPrev = new URLSearchParams(baseParams);
  accountPrev.set('account_page', String(Math.max(1, accountPage - 1)));
  const accountNext = new URLSearchParams(baseParams);
  accountNext.set(
    'account_page',
    String(Math.min(Math.max(1, Math.ceil(accounts.pagination.total / 20)), accountPage + 1))
  );

  const jobPrev = new URLSearchParams(baseParams);
  jobPrev.set('job_page', String(Math.max(1, jobPage - 1)));
  const jobNext = new URLSearchParams(baseParams);
  jobNext.set('job_page', String(Math.min(Math.max(1, Math.ceil(jobs.pagination.total / 20)), jobPage + 1)));

  const errPrev = new URLSearchParams(baseParams);
  errPrev.set('err_page', String(Math.max(1, errPage - 1)));
  const errNext = new URLSearchParams(baseParams);
  errNext.set('err_page', String(Math.min(Math.max(1, Math.ceil(errors.pagination.total / 20)), errPage + 1)));

  return (
    <section className="space-y-10">
      <div>
        <h1 className="display-2">Ingestion / Platform links</h1>
        <p className="text-muted-foreground text-sm">Comptes plateformes, jobs et erreurs.</p>
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Platform accounts</h2>
          <p className="text-muted-foreground text-sm">{accounts.pagination.total} accounts</p>
        </div>
        <form>
          <AdminFilters>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="account_q">
                Recherche
              </label>
              <input
                id="account_q"
                name="account_q"
                defaultValue={accountQ}
                placeholder="handle / platform_user_id"
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
                Filtrer
              </Button>
            </div>
          </AdminFilters>
        </form>

        <AdminTable>
          <thead className="text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Créé</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {accounts.items.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">
                  Aucun compte
                </td>
              </tr>
            ) : (
              accounts.items.map((item) => (
                <tr key={item.id} className="hover:bg-muted/30">
                  <td className="px-4 py-4">
                    <div className="font-medium">
                      {item.platform} • @{item.handle || '-'}
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
                        <Link href={`/app/admin/users/${item.user_id}`}>Voir user</Link>
                      </Button>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-xs text-muted-foreground">{formatDateTime(item.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </AdminTable>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Page {accountPage}</span>
          <div className="flex items-center gap-2">
            {accountPage <= 1 ? (
              <span className="px-4 py-2 text-xs text-muted-foreground">Précédent</span>
            ) : (
              <Button asChild variant="secondary" size="sm">
                <Link href={`/app/admin/ingestion?${accountPrev.toString()}`}>Précédent</Link>
              </Button>
            )}
            {accountPage >= Math.max(1, Math.ceil(accounts.pagination.total / 20)) ? (
              <span className="px-4 py-2 text-xs text-muted-foreground">Suivant</span>
            ) : (
              <Button asChild variant="secondary" size="sm">
                <Link href={`/app/admin/ingestion?${accountNext.toString()}`}>Suivant</Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Ingestion jobs</h2>
          <p className="text-muted-foreground text-sm">{jobs.pagination.total} jobs</p>
        </div>
        <form>
          <AdminFilters>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="job_q">
                Recherche
              </label>
              <input
                id="job_q"
                name="job_q"
                defaultValue={jobQ}
                placeholder="kind / error"
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="job_status">
                Statut
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
                Filtrer
              </Button>
            </div>
          </AdminFilters>
        </form>

        <AdminTable>
          <thead className="text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Job</th>
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Scheduled</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {jobs.items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  Aucun job
                </td>
              </tr>
            ) : (
              jobs.items.map((item) => (
                <tr key={item.id} className="hover:bg-muted/30">
                  <td className="px-4 py-4">
                    <div className="font-medium">{item.kind}</div>
                    <div className="text-xs text-muted-foreground">#{item.id} • attempts {item.attempts}</div>
                    {item.last_error ? (
                      <div className="text-xs text-muted-foreground mt-1">{item.last_error.slice(0, 120)}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-4 text-xs text-muted-foreground">
                    <div>{item.account?.platform || '-'}</div>
                    <div>@{item.account?.handle || '-'}</div>
                    <div>{item.account?.user?.email || item.account?.user_id || '-'}</div>
                  </td>
                  <td className="px-4 py-4">
                    <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                  </td>
                  <td className="px-4 py-4 text-xs text-muted-foreground">{formatDateTime(item.scheduled_at)}</td>
                  <td className="px-4 py-4">
                    <AdminIngestionJobActions jobId={item.id} status={item.status} canWrite={canWrite} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </AdminTable>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Page {jobPage}</span>
          <div className="flex items-center gap-2">
            {jobPage <= 1 ? (
              <span className="px-4 py-2 text-xs text-muted-foreground">Précédent</span>
            ) : (
              <Button asChild variant="secondary" size="sm">
                <Link href={`/app/admin/ingestion?${jobPrev.toString()}`}>Précédent</Link>
              </Button>
            )}
            {jobPage >= Math.max(1, Math.ceil(jobs.pagination.total / 20)) ? (
              <span className="px-4 py-2 text-xs text-muted-foreground">Suivant</span>
            ) : (
              <Button asChild variant="secondary" size="sm">
                <Link href={`/app/admin/ingestion?${jobNext.toString()}`}>Suivant</Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Ingestion errors</h2>
          <p className="text-muted-foreground text-sm">{errors.pagination.total} errors</p>
        </div>
        <form>
          <AdminFilters>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="err_q">
                Recherche
              </label>
              <input
                id="err_q"
                name="err_q"
                defaultValue={errQ}
                placeholder="error_code"
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
                Filtrer
              </Button>
            </div>
          </AdminFilters>
        </form>

        <AdminTable>
          <thead className="text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Error</th>
              <th className="px-4 py-3">Job</th>
              <th className="px-4 py-3">Détails</th>
              <th className="px-4 py-3">Créé</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {errors.items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                  Aucune erreur
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
                        <Badge variant="success">Résolu</Badge>
                      ) : (
                        <Badge variant="warning">À traiter</Badge>
                      )}
                      {item.resolved_at ? (
                        <span className="text-xs text-muted-foreground">{formatDateTime(item.resolved_at)}</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-xs text-muted-foreground">
                    <div>job #{item.job_id}</div>
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
                  <td className="px-4 py-4 text-xs text-muted-foreground">{formatDateTime(item.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </AdminTable>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Page {errPage}</span>
          <div className="flex items-center gap-2">
            {errPage <= 1 ? (
              <span className="px-4 py-2 text-xs text-muted-foreground">Précédent</span>
            ) : (
              <Button asChild variant="secondary" size="sm">
                <Link href={`/app/admin/ingestion?${errPrev.toString()}`}>Précédent</Link>
              </Button>
            )}
            {errPage >= Math.max(1, Math.ceil(errors.pagination.total / 20)) ? (
              <span className="px-4 py-2 text-xs text-muted-foreground">Suivant</span>
            ) : (
              <Button asChild variant="secondary" size="sm">
                <Link href={`/app/admin/ingestion?${errNext.toString()}`}>Suivant</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
