import Link from 'next/link';
import { fetchAdminApi } from '@/lib/admin/request';
import { redirect } from 'next/navigation';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { AdminFilters } from '@/components/admin/admin-filters';
import { AdminTable } from '@/components/admin/admin-table';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

  const kycPrev = new URLSearchParams(baseParams);
  kycPrev.set('kyc_page', String(Math.max(1, kycPage - 1)));
  const kycNext = new URLSearchParams(baseParams);
  kycNext.set(
    'kyc_page',
    String(Math.min(Math.max(1, Math.ceil(kyc.pagination.total / 20)), kycPage + 1))
  );

  const flagPrev = new URLSearchParams(baseParams);
  flagPrev.set('flag_page', String(Math.max(1, flagPage - 1)));
  const flagNext = new URLSearchParams(baseParams);
  flagNext.set(
    'flag_page',
    String(Math.min(Math.max(1, Math.ceil(flags.pagination.total / 20)), flagPage + 1))
  );

  return (
    <section className="space-y-10">
      <div>
        <h1 className="display-2">KYC & risk</h1>
        <p className="text-muted-foreground text-sm">KYC checks + risk flags.</p>
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">KYC checks</h2>
          <p className="text-muted-foreground text-sm">{kyc.pagination.total} rows</p>
        </div>
        <form>
          <AdminFilters>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="kyc_q">
                Recherche
              </label>
              <input
                id="kyc_q"
                name="kyc_q"
                defaultValue={kycQ}
                placeholder="reason / provider"
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="kyc_status">
                Statut
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
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Provider</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Mis à jour</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {kyc.items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                  Aucun résultat
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
                        <Link href={`/app/admin/users/${item.user_id}`}>Voir user</Link>
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
                  <td className="px-4 py-4 text-xs text-muted-foreground">{formatDateTime(item.updated_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </AdminTable>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Page {kycPage}</span>
          <div className="flex items-center gap-2">
            {kycPage <= 1 ? (
              <span className="px-4 py-2 text-xs text-muted-foreground">Précédent</span>
            ) : (
              <Button asChild variant="secondary" size="sm">
                <Link href={`/app/admin/risk?${kycPrev.toString()}`}>Précédent</Link>
              </Button>
            )}
            {kycPage >= Math.max(1, Math.ceil(kyc.pagination.total / 20)) ? (
              <span className="px-4 py-2 text-xs text-muted-foreground">Suivant</span>
            ) : (
              <Button asChild variant="secondary" size="sm">
                <Link href={`/app/admin/risk?${kycNext.toString()}`}>Suivant</Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Risk flags</h2>
          <p className="text-muted-foreground text-sm">{flags.pagination.total} flags</p>
        </div>
        <form>
          <AdminFilters>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="flag_q">
                Recherche
              </label>
              <input
                id="flag_q"
                name="flag_q"
                defaultValue={flagQ}
                placeholder="reason"
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
                <option value="false">Ouvert</option>
                <option value="true">Resolved</option>
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
              <th className="px-4 py-3">Flag</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Severity</th>
              <th className="px-4 py-3">Créé</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {flags.items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                  Aucun signal
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
                        <Link href={`/app/admin/users/${item.user_id}`}>Voir user</Link>
                      </Button>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <Badge variant={severityVariant(item.severity)}>{item.severity}</Badge>
                  </td>
                  <td className="px-4 py-4 text-xs text-muted-foreground">{formatDateTime(item.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </AdminTable>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Page {flagPage}</span>
          <div className="flex items-center gap-2">
            {flagPage <= 1 ? (
              <span className="px-4 py-2 text-xs text-muted-foreground">Précédent</span>
            ) : (
              <Button asChild variant="secondary" size="sm">
                <Link href={`/app/admin/risk?${flagPrev.toString()}`}>Précédent</Link>
              </Button>
            )}
            {flagPage >= Math.max(1, Math.ceil(flags.pagination.total / 20)) ? (
              <span className="px-4 py-2 text-xs text-muted-foreground">Suivant</span>
            ) : (
              <Button asChild variant="secondary" size="sm">
                <Link href={`/app/admin/risk?${flagNext.toString()}`}>Suivant</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
