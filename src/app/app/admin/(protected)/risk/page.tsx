import Link from 'next/link';
import { fetchAdminApi } from '@/lib/admin/request';
import { redirect } from 'next/navigation';
import { AlertTriangle, ListChecks, ShieldAlert } from 'lucide-react';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { AdminFilters } from '@/components/admin/admin-filters';
import { AdminTable } from '@/components/admin/admin-table';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateTime } from '@/lib/formatters';

type KycItem = {
  user_id: string;
  provider: string;
  status: string;
  reason: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  user: { id: string; display_name: string | null; email: string } | null;
};

type RiskFlagItem = {
  id: number;
  user_id: string;
  reason: string;
  severity: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  user: { id: string; display_name: string | null; email: string } | null;
};

type Paged<T> = { items: T[]; pagination: { total: number; page: number; limit: number } };

function kycVariant(status: string): BadgeProps['variant'] {
  if (status === 'verified') return 'success';
  if (status === 'failed') return 'danger';
  return 'warning';
}

function severityVariant(severity: string): BadgeProps['variant'] {
  if (severity === 'critical') return 'danger';
  if (severity === 'high') return 'warning';
  if (severity === 'medium') return 'info';
  return 'secondary';
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

export default async function AdminRiskPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  try {
    await requireAdminPermission('risk.read');
  } catch {
    redirect('/forbidden');
  }

  const kycStatus = typeof searchParams.kyc_status === 'string' ? searchParams.kyc_status : '';
  const kycQ = typeof searchParams.kyc_q === 'string' ? searchParams.kyc_q : '';
  const kycPage = typeof searchParams.kyc_page === 'string' ? Number(searchParams.kyc_page) : 1;

  const flagSeverity =
    typeof searchParams.flag_severity === 'string' ? searchParams.flag_severity : '';
  const flagResolved =
    typeof searchParams.flag_resolved === 'string' ? searchParams.flag_resolved : '';
  const flagQ = typeof searchParams.flag_q === 'string' ? searchParams.flag_q : '';
  const flagPage =
    typeof searchParams.flag_page === 'string' ? Number(searchParams.flag_page) : 1;

  const kycParams = new URLSearchParams();
  if (kycStatus) kycParams.set('status', kycStatus);
  if (kycQ) kycParams.set('q', kycQ);
  kycParams.set('page', String(kycPage));
  kycParams.set('limit', '20');

  const flagsParams = new URLSearchParams();
  if (flagSeverity) flagsParams.set('severity', flagSeverity);
  if (flagResolved) flagsParams.set('resolved', flagResolved);
  if (flagQ) flagsParams.set('q', flagQ);
  flagsParams.set('page', String(flagPage));
  flagsParams.set('limit', '20');

  const [kycRes, flagsRes] = await Promise.all([
    fetchAdminApi(`/api/admin/kyc-checks?${kycParams.toString()}`, { cache: 'no-store' }),
    fetchAdminApi(`/api/admin/risk-flags?${flagsParams.toString()}`, { cache: 'no-store' }),
  ]);

  const kyc: Paged<KycItem> = kycRes.ok
    ? await kycRes.json()
    : { items: [], pagination: { total: 0, page: 1, limit: 20 } };
  const flags: Paged<RiskFlagItem> = flagsRes.ok
    ? await flagsRes.json()
    : { items: [], pagination: { total: 0, page: 1, limit: 20 } };

  const baseParams = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === 'string') baseParams.set(key, value);
  }

  const kycTotalPages = Math.max(1, Math.ceil(kyc.pagination.total / 20));
  const flagTotalPages = Math.max(1, Math.ceil(flags.pagination.total / 20));

  const kycPrev = new URLSearchParams(baseParams);
  kycPrev.set('kyc_page', String(Math.max(1, kycPage - 1)));
  const kycNext = new URLSearchParams(baseParams);
  kycNext.set('kyc_page', String(Math.min(kycTotalPages, kycPage + 1)));

  const flagPrev = new URLSearchParams(baseParams);
  flagPrev.set('flag_page', String(Math.max(1, flagPage - 1)));
  const flagNext = new URLSearchParams(baseParams);
  flagNext.set('flag_page', String(Math.min(flagTotalPages, flagPage + 1)));

  const kycCounts = kyc.items.reduce(
    (acc, item) => {
      if (item.status === 'verified') acc.verified += 1;
      else if (item.status === 'failed') acc.failed += 1;
      else acc.pending += 1;
      return acc;
    },
    { pending: 0, verified: 0, failed: 0 }
  );

  const flagSeverityCounts = flags.items.reduce(
    (acc, item) => {
      if (item.severity === 'critical') acc.critical += 1;
      else if (item.severity === 'high') acc.high += 1;
      else if (item.severity === 'medium') acc.medium += 1;
      else acc.low += 1;
      return acc;
    },
    { low: 0, medium: 0, high: 0, critical: 0 }
  );

  const resolvedCount = flags.items.filter((item) => item.resolved_at).length;
  const openCount = flags.items.length - resolvedCount;

  return (
    <section className="space-y-8">
      <AdminPageHeader
        title="KYC and risk"
        description="Monitor KYC reviews and risk flags across the platform."
        icon={<ShieldAlert className="h-5 w-5" />}
        badges={
          <>
            <Badge variant="secondary">{kyc.pagination.total} KYC checks</Badge>
            <Badge variant="secondary">{flags.pagination.total} risk flags</Badge>
          </>
        }
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/app/admin/users">Users</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/app/admin/finance">Finance</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">KYC total</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{kyc.pagination.total}</div>
            <Badge variant="secondary">{kyc.items.length} on page</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">KYC status (page)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge variant="secondary">Verified {kycCounts.verified}</Badge>
            <Badge variant="secondary">Pending {kycCounts.pending}</Badge>
            <Badge variant="secondary">Failed {kycCounts.failed}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Risk flags</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{flags.pagination.total}</div>
            <Badge variant="secondary">{openCount} open</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Severity (page)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge variant="secondary">Critical {flagSeverityCounts.critical}</Badge>
            <Badge variant="secondary">High {flagSeverityCounts.high}</Badge>
            <Badge variant="secondary">Medium {flagSeverityCounts.medium}</Badge>
            <Badge variant="secondary">Low {flagSeverityCounts.low}</Badge>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <SectionHeader
          icon={<ListChecks className="h-5 w-5" />}
          title="KYC checks"
          subtitle="Review provider status, reason, and user profile."
          badges={
            <>
              <Badge variant="secondary">Verified {kycCounts.verified}</Badge>
              <Badge variant="secondary">Pending {kycCounts.pending}</Badge>
              <Badge variant="secondary">Failed {kycCounts.failed}</Badge>
            </>
          }
        />
        <Card>
          <CardContent className="space-y-4 pt-6">
            <form>
              <AdminFilters>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="kyc_q">
                    Search
                  </label>
                  <input
                    id="kyc_q"
                    name="kyc_q"
                    defaultValue={kycQ}
                    placeholder="Reason or provider"
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="kyc_status">
                    Status
                  </label>
                  <select
                    id="kyc_status"
                    name="kyc_status"
                    defaultValue={kycStatus || ''}
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  >
                    <option value="">All</option>
                    <option value="pending">pending</option>
                    <option value="verified">verified</option>
                    <option value="failed">failed</option>
                  </select>
                </div>
                <div className="flex items-end gap-2">
                  <Button type="submit" variant="primary">
                    Apply
                  </Button>
                  <Button asChild variant="ghost">
                    <Link href="/app/admin/risk">Reset</Link>
                  </Button>
                </div>
              </AdminFilters>
            </form>

            <AdminTable>
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {kyc.items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                      No results found.
                    </td>
                  </tr>
                ) : (
                  kyc.items.map((item) => (
                    <tr key={item.user_id} className="hover:bg-muted/30">
                      <td className="px-4 py-4">
                        <div className="font-medium">{item.user?.email || item.user_id}</div>
                        <div className="text-xs text-muted-foreground">{item.user?.display_name || '-'}</div>
                        <div className="mt-2">
                          <Button asChild variant="secondary" size="sm">
                            <Link href={`/app/admin/users/${item.user_id}`}>View user</Link>
                          </Button>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-xs text-muted-foreground">{item.provider}</td>
                      <td className="px-4 py-4">
                        <Badge variant={kycVariant(item.status)}>{item.status}</Badge>
                        {item.reason ? (
                          <div className="text-xs text-muted-foreground mt-1">{item.reason.slice(0, 120)}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 text-xs text-muted-foreground">
                        {formatDateTime(item.updated_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </AdminTable>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Page {kycPage} / {kycTotalPages}
              </span>
              <div className="flex items-center gap-2">
                {kycPage <= 1 ? (
                  <span className="px-4 py-2 text-xs text-muted-foreground">Prev</span>
                ) : (
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/app/admin/risk?${kycPrev.toString()}`}>Prev</Link>
                  </Button>
                )}
                {kycPage >= kycTotalPages ? (
                  <span className="px-4 py-2 text-xs text-muted-foreground">Next</span>
                ) : (
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/app/admin/risk?${kycNext.toString()}`}>Next</Link>
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
          title="Risk flags"
          subtitle="Investigate and resolve flagged accounts."
          badges={
            <>
              <Badge variant="secondary">Open {openCount}</Badge>
              <Badge variant="secondary">Resolved {resolvedCount}</Badge>
              <Badge variant="secondary">Critical {flagSeverityCounts.critical}</Badge>
            </>
          }
        />
        <Card>
          <CardContent className="space-y-4 pt-6">
            <form>
              <AdminFilters>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="flag_q">
                    Search
                  </label>
                  <input
                    id="flag_q"
                    name="flag_q"
                    defaultValue={flagQ}
                    placeholder="Reason"
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="flag_severity">
                    Severity
                  </label>
                  <select
                    id="flag_severity"
                    name="flag_severity"
                    defaultValue={flagSeverity || ''}
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  >
                    <option value="">All</option>
                    <option value="low">low</option>
                    <option value="medium">medium</option>
                    <option value="high">high</option>
                    <option value="critical">critical</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="flag_resolved">
                    Resolved
                  </label>
                  <select
                    id="flag_resolved"
                    name="flag_resolved"
                    defaultValue={flagResolved || ''}
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  >
                    <option value="">All</option>
                    <option value="false">Open</option>
                    <option value="true">Resolved</option>
                  </select>
                </div>
                <div className="flex items-end gap-2">
                  <Button type="submit" variant="primary">
                    Apply
                  </Button>
                  <Button asChild variant="ghost">
                    <Link href="/app/admin/risk">Reset</Link>
                  </Button>
                </div>
              </AdminFilters>
            </form>

            <AdminTable>
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Flag</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Severity</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {flags.items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                      No flags found.
                    </td>
                  </tr>
                ) : (
                  flags.items.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/30">
                      <td className="px-4 py-4">
                        <div className="font-medium">{item.reason}</div>
                        <div className="text-xs text-muted-foreground">#{item.id}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.resolved_at ? `resolved ${formatDateTime(item.resolved_at)}` : 'open'}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-medium">{item.user?.email || item.user_id}</div>
                        <div className="text-xs text-muted-foreground">{item.user?.display_name || '-'}</div>
                        <div className="mt-2">
                          <Button asChild variant="secondary" size="sm">
                            <Link href={`/app/admin/users/${item.user_id}`}>View user</Link>
                          </Button>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant={severityVariant(item.severity)}>{item.severity}</Badge>
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
                Page {flagPage} / {flagTotalPages}
              </span>
              <div className="flex items-center gap-2">
                {flagPage <= 1 ? (
                  <span className="px-4 py-2 text-xs text-muted-foreground">Prev</span>
                ) : (
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/app/admin/risk?${flagPrev.toString()}`}>Prev</Link>
                  </Button>
                )}
                {flagPage >= flagTotalPages ? (
                  <span className="px-4 py-2 text-xs text-muted-foreground">Next</span>
                ) : (
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/app/admin/risk?${flagNext.toString()}`}>Next</Link>
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
