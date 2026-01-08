import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AdminFilters } from '@/components/admin/admin-filters';
import { Button } from '@/components/ui/button';
import { hasAdminPermission, requireAdminPermission } from '@/lib/admin/rbac';
import { Download, ListChecks } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function AdminExportsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  let canWrite = false;
  try {
    const { access } = await requireAdminPermission('exports.read');
    canWrite = hasAdminPermission(access, 'exports.write');
  } catch {
    redirect('/forbidden');
  }

  const type = typeof searchParams.type === 'string' ? searchParams.type : 'users';
  const q = typeof searchParams.q === 'string' ? searchParams.q : '';
  const limit = typeof searchParams.limit === 'string' ? searchParams.limit : '5000';

  const params = new URLSearchParams();
  params.set('type', type);
  if (q) params.set('q', q);
  params.set('limit', limit);

  const downloadHref = `/api/admin/exports?${params.toString()}`;
  const quickExports = [
    { label: 'Users', type: 'users' },
    { label: 'Brands', type: 'brands' },
    { label: 'Contests', type: 'contests' },
    { label: 'Submissions', type: 'submissions' },
    { label: 'Payments', type: 'payments_brand' },
    { label: 'Invoices', type: 'invoices' },
  ];

  return (
    <section className="space-y-8">
      <AdminPageHeader
        title="Exports"
        description="Generate CSV exports for operational data."
        icon={<Download className="h-5 w-5" />}
        badges={
          <>
            <Badge variant="secondary">CSV</Badge>
            <Badge variant="secondary">Limit {limit}</Badge>
            <Badge variant={canWrite ? 'success' : 'secondary'}>
              {canWrite ? 'Write access' : 'Read only'}
            </Badge>
          </>
        }
        actions={
          <Button asChild variant="secondary">
            <Link href="/app/admin/audit">Audit</Link>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Export type</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{type}</div>
            <Badge variant="secondary">Current</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Row limit</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{limit}</div>
            <Badge variant="secondary">Max rows</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Filter</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{q ? 'Filtered' : 'All'}</div>
            <Badge variant="secondary">{q ? 'Query' : 'None'}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Access</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{canWrite ? 'Write' : 'Read'}</div>
            <Badge variant="secondary">Permissions</Badge>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-muted/60 border border-border flex items-center justify-center">
            <ListChecks className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold">Build export</div>
            <div className="text-sm text-muted-foreground">Pick a table and optional filters.</div>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form>
              <AdminFilters>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="type">
                    Table
                  </label>
                  <select
                    id="type"
                    name="type"
                    defaultValue={type}
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  >
                    <option value="users">Users (profiles)</option>
                    <option value="brands">Brands (profile_brands)</option>
                    <option value="orgs">Organizations (orgs)</option>
                    <option value="contests">Contests</option>
                    <option value="submissions">Submissions</option>
                    <option value="payments_brand">Brand payments</option>
                    <option value="invoices">Invoices</option>
                    <option value="platform_accounts">Platform accounts</option>
                    <option value="ingestion_jobs">Ingestion jobs</option>
                    <option value="ingestion_errors">Ingestion errors</option>
                    <option value="webhook_endpoints">Webhook endpoints</option>
                    <option value="webhook_deliveries">Webhook deliveries</option>
                    <option value="kyc_checks">KYC</option>
                    <option value="risk_flags">Risk flags</option>
                    <option value="assets">Assets (storage)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="q">
                    Search
                  </label>
                  <input
                    id="q"
                    name="q"
                    defaultValue={q}
                    placeholder="Optional filter (table specific)"
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="limit">
                    Limit
                  </label>
                  <input
                    id="limit"
                    name="limit"
                    defaultValue={limit}
                    placeholder="5000"
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  />
                </div>

                <div className="flex items-end gap-2">
                  <Button type="submit" variant="primary">
                    Apply
                  </Button>
                  {canWrite ? (
                    <Button asChild variant="secondary">
                      <a href={downloadHref}>Download CSV</a>
                    </Button>
                  ) : (
                    <Button variant="secondary" disabled title="Requires exports.write">
                      Download CSV
                    </Button>
                  )}
                </div>
              </AdminFilters>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-muted/60 border border-border flex items-center justify-center">
            <Download className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold">Quick exports</div>
            <div className="text-sm text-muted-foreground">One click presets for common tables.</div>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-2">
              {quickExports.map((item) => (
                <Button key={item.type} asChild variant="secondary" size="sm">
                  <Link href={`/app/admin/exports?type=${item.type}&limit=${limit}`}>{item.label}</Link>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
