import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AdminFilters } from '@/components/admin/admin-filters';
import { Button } from '@/components/ui/button';
import { hasAdminPermission, requireAdminPermission } from '@/lib/admin/rbac';

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

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="display-2">Exports</h1>
          <p className="text-sm text-muted-foreground">
            Exporte des tables opérationnelles au format CSV.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/app/admin/audit">Audit</Link>
        </Button>
      </div>

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
              <option value="users">Utilisateurs (profiles)</option>
              <option value="brands">Marques (profile_brands)</option>
              <option value="orgs">Organisations (orgs)</option>
              <option value="contests">Concours</option>
              <option value="submissions">Soumissions</option>
              <option value="payments_brand">Paiements marques</option>
              <option value="invoices">Factures</option>
              <option value="platform_accounts">Comptes plateformes</option>
              <option value="ingestion_jobs">Jobs ingestion</option>
              <option value="ingestion_errors">Erreurs ingestion</option>
              <option value="webhook_endpoints">Endpoints webhook</option>
              <option value="webhook_deliveries">Livraisons webhook</option>
              <option value="kyc_checks">KYC</option>
              <option value="risk_flags">Risk flags</option>
              <option value="assets">Assets (storage)</option>
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="q">
              Recherche
            </label>
            <input
              id="q"
              name="q"
              defaultValue={q}
              placeholder="Filtre (selon la table)"
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="limit">
              Limite
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
              Appliquer
            </Button>
            {canWrite ? (
              <Button asChild variant="secondary">
                <a href={downloadHref}>Télécharger CSV</a>
              </Button>
            ) : (
              <Button variant="secondary" disabled title="Accès requis : exports.write">
                Télécharger CSV
              </Button>
            )}
          </div>
        </AdminFilters>
      </form>
    </section>
  );
}
