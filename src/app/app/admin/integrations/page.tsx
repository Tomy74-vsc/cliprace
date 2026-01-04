import Link from 'next/link';
import { fetchAdminApi } from '@/lib/admin/request';
import { redirect } from 'next/navigation';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { AdminFilters } from '@/components/admin/admin-filters';
import { AdminTable } from '@/components/admin/admin-table';
import { AdminEntitySelect } from '@/components/admin/admin-entity-select';
import { AdminHelpTooltip } from '@/components/admin/admin-help-tooltip';
import { AdminObjectSummary } from '@/components/admin/admin-object-summary';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateTime } from '@/lib/formatters';

type EndpointItem = {
  id: string;
  org_id: string;
  endpoint_url: string;
  active: boolean;
  created_at: string;
  updated_at: string;
  org: { id: string; name: string | null; billing_email: string | null } | null;
};

type DeliveryItem = {
  id: number;
  endpoint_id: string;
  event: string;
  status: string;
  retry_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  payload: unknown;
  endpoint:
    | {
        id: string;
        org_id: string;
        endpoint_url: string;
        org: { id: string; name: string | null } | null;
      }
    | null;
};

type Paged<T> = { items: T[]; pagination: { total: number; page: number; limit: number } };

function activeVariant(active: boolean): BadgeProps['variant'] {
  return active ? 'success' : 'secondary';
}

function statusVariant(status: string): BadgeProps['variant'] {
  if (status === 'success') return 'success';
  if (status === 'failed') return 'danger';
  if (status === 'pending') return 'warning';
  return 'default';
}

export default async function AdminIntegrationsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  try {
    await requireAdminPermission('integrations.read');
  } catch {
    redirect('/forbidden');
  }

  const endpointQ = typeof searchParams.endpoint_q === 'string' ? searchParams.endpoint_q : '';
  const endpointOrgId =
    typeof searchParams.endpoint_org_id === 'string' ? searchParams.endpoint_org_id : '';
  const endpointActive =
    typeof searchParams.endpoint_active === 'string' ? searchParams.endpoint_active : '';
  const endpointPage =
    typeof searchParams.endpoint_page === 'string' ? Number(searchParams.endpoint_page) : 1;

  const deliveryQ = typeof searchParams.delivery_q === 'string' ? searchParams.delivery_q : '';
  const deliveryOrgId =
    typeof searchParams.delivery_org_id === 'string' ? searchParams.delivery_org_id : '';
  const deliveryStatus =
    typeof searchParams.delivery_status === 'string' ? searchParams.delivery_status : '';
  const deliveryEvent =
    typeof searchParams.delivery_event === 'string' ? searchParams.delivery_event : '';
  const deliveryPage =
    typeof searchParams.delivery_page === 'string' ? Number(searchParams.delivery_page) : 1;

  const endpointParams = new URLSearchParams();
  if (endpointQ) endpointParams.set('q', endpointQ);
  if (endpointOrgId) endpointParams.set('org_id', endpointOrgId);
  if (endpointActive) endpointParams.set('active', endpointActive);
  endpointParams.set('page', String(endpointPage));
  endpointParams.set('limit', '20');

  const deliveryParams = new URLSearchParams();
  if (deliveryQ) deliveryParams.set('q', deliveryQ);
  if (deliveryOrgId) deliveryParams.set('org_id', deliveryOrgId);
  if (deliveryStatus) deliveryParams.set('status', deliveryStatus);
  if (deliveryEvent) deliveryParams.set('event', deliveryEvent);
  deliveryParams.set('page', String(deliveryPage));
  deliveryParams.set('limit', '20');

  const [endpointsRes, deliveriesRes, statsRes] = await Promise.all([
    fetchAdminApi(`/api/admin/webhook-endpoints?${endpointParams.toString()}`, { cache: 'no-store' }),
    fetchAdminApi(`/api/admin/webhook-deliveries?${deliveryParams.toString()}`, { cache: 'no-store' }),
    fetchAdminApi('/api/admin/webhook-deliveries/stats?range=24h', { cache: 'no-store' }),
  ]);

  const endpoints: Paged<EndpointItem> = endpointsRes.ok
    ? await endpointsRes.json()
    : { items: [], pagination: { total: 0, page: 1, limit: 20 } };
  const deliveries: Paged<DeliveryItem> = deliveriesRes.ok
    ? await deliveriesRes.json()
    : { items: [], pagination: { total: 0, page: 1, limit: 20 } };

  const stats: { top: Array<{ error: string; count: number }>; total_failed: number } = statsRes.ok
    ? await statsRes.json()
    : { top: [], total_failed: 0 };

  const baseParams = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === 'string') baseParams.set(key, value);
  }

  const endpointPrev = new URLSearchParams(baseParams);
  endpointPrev.set('endpoint_page', String(Math.max(1, endpointPage - 1)));
  const endpointNext = new URLSearchParams(baseParams);
  endpointNext.set(
    'endpoint_page',
    String(Math.min(Math.max(1, Math.ceil(endpoints.pagination.total / 20)), endpointPage + 1))
  );

  const deliveryPrev = new URLSearchParams(baseParams);
  deliveryPrev.set('delivery_page', String(Math.max(1, deliveryPage - 1)));
  const deliveryNext = new URLSearchParams(baseParams);
  deliveryNext.set(
    'delivery_page',
    String(Math.min(Math.max(1, Math.ceil(deliveries.pagination.total / 20)), deliveryPage + 1))
  );

  return (
    <section className="space-y-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="display-2">Intégrations</h1>
          <p className="text-muted-foreground text-sm">Webhooks sortants (endpoints + deliveries).</p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/app/admin/audit">Audit & logs</Link>
        </Button>
      </div>

      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Endpoints webhook</h2>
            <p className="text-muted-foreground text-sm">{endpoints.pagination.total} endpoints</p>
          </div>
          <AdminHelpTooltip
            label="Aide sur les endpoints webhook"
            content={
              <div className="space-y-1">
                <div className="font-medium">Endpoints</div>
                <div>
                  Un endpoint inactif ne re\u00e7oit plus d\u2019\u00e9v\u00e9nements. Si tu vois
                  des \u00e9checs r\u00e9currents, v\u00e9rifie l\u2019URL, les secrets, et les
                  restrictions r\u00e9seau c\u00f4t\u00e9 marque.
                </div>
              </div>
            }
          />
        </div>

        <form>
          <AdminFilters>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="endpoint_q">
                Recherche
              </label>
              <input
                id="endpoint_q"
                name="endpoint_q"
                defaultValue={endpointQ}
                placeholder="URL"
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
              />
            </div>
            <AdminEntitySelect
              kind="org"
              name="endpoint_org_id"
              label="Organisation"
              placeholder="Rechercher une organisation..."
              defaultValue={endpointOrgId || undefined}
            />
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="endpoint_active">
                Actif
              </label>
              <select
                id="endpoint_active"
                name="endpoint_active"
                defaultValue={endpointActive || ''}
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
              >
                <option value="">Tous</option>
                <option value="true">Actif</option>
                <option value="false">Inactif</option>
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
              <th className="px-4 py-3">Endpoint</th>
              <th className="px-4 py-3">Organisation</th>
              <th className="px-4 py-3">Actif</th>
              <th className="px-4 py-3">Mis à jour</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {endpoints.items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                  Aucun endpoint
                </td>
              </tr>
            ) : (
              endpoints.items.map((item) => (
                <tr key={item.id} className="hover:bg-muted/30">
                  <td className="px-4 py-4">
                    <div className="font-medium">{item.endpoint_url}</div>
                    <div className="text-xs text-muted-foreground">{item.id}</div>
                  </td>
                  <td className="px-4 py-4 text-xs text-muted-foreground">
                    <div>{item.org?.name || '-'}</div>
                    <div>{item.org?.billing_email || item.org_id}</div>
                  </td>
                  <td className="px-4 py-4">
                    <Badge variant={activeVariant(item.active)}>{item.active ? 'actif' : 'inactif'}</Badge>
                  </td>
                  <td className="px-4 py-4 text-xs text-muted-foreground">{formatDateTime(item.updated_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </AdminTable>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Page {endpointPage}</span>
          <div className="flex items-center gap-2">
            {endpointPage <= 1 ? (
              <span className="px-4 py-2 text-xs text-muted-foreground">Précédent</span>
            ) : (
              <Button asChild variant="secondary" size="sm">
                <Link href={`/app/admin/integrations?${endpointPrev.toString()}`}>Précédent</Link>
              </Button>
            )}
            {endpointPage >= Math.max(1, Math.ceil(endpoints.pagination.total / 20)) ? (
              <span className="px-4 py-2 text-xs text-muted-foreground">Suivant</span>
            ) : (
              <Button asChild variant="secondary" size="sm">
                <Link href={`/app/admin/integrations?${endpointNext.toString()}`}>Suivant</Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Livraisons webhook</h2>
            <p className="text-muted-foreground text-sm">{deliveries.pagination.total} deliveries</p>
          </div>
          <AdminHelpTooltip
            label="Aide sur les livraisons webhook"
            content={
              <div className="space-y-1">
                <div className="font-medium">Diagnostic</div>
                <div>
                  Filtre les statuts \u201cfailed\u201d et regroupe par endpoint. Le champ
                  last_error indique la cause : timeout, 4xx/5xx, signature invalide\u2026
                </div>
                <div>Apr\u00e8s correction, relance depuis l\u2019action \u201cRetry\u201d.</div>
              </div>
            }
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Top erreurs (24h)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {stats.top.length === 0 ? (
                <div className="text-sm text-muted-foreground">Aucune erreur récente.</div>
              ) : (
                stats.top.map((e) => (
                  <div key={e.error} className="flex items-start justify-between gap-3">
                    <div className="text-xs text-muted-foreground line-clamp-2">{e.error}</div>
                    <Badge variant="secondary">{e.count}</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Playbook (rapide)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <div>1) Filtrer “failed” et identifier l’endpoint.</div>
              <div>2) Vérifier URL + secret + réseau (marque).</div>
              <div>3) Corriger, puis relancer via “Relancer”.</div>
              <div>4) Surveiller la timeline (success/pending).</div>
            </CardContent>
          </Card>
        </div>

        <form>
          <AdminFilters>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="delivery_q">
                Recherche
              </label>
              <input
                id="delivery_q"
                name="delivery_q"
                defaultValue={deliveryQ}
                placeholder="event / error"
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
              />
            </div>
            <AdminEntitySelect
              kind="org"
              name="delivery_org_id"
              label="Organisation"
              placeholder="Rechercher une organisation..."
              defaultValue={deliveryOrgId || undefined}
            />
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="delivery_status">
                Statut
              </label>
              <select
                id="delivery_status"
                name="delivery_status"
                defaultValue={deliveryStatus || ''}
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
              >
                <option value="">Tous</option>
                <option value="pending">pending</option>
                <option value="success">success</option>
                <option value="failed">failed</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="delivery_event">
                Event
              </label>
              <input
                id="delivery_event"
                name="delivery_event"
                defaultValue={deliveryEvent}
                placeholder="submission.approved"
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
              <th className="px-4 py-3">Livraison</th>
              <th className="px-4 py-3">Endpoint</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Payload</th>
              <th className="px-4 py-3">Créé</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {deliveries.items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  Aucune livraison
                </td>
              </tr>
            ) : (
              deliveries.items.map((item) => (
                <tr key={item.id} className="hover:bg-muted/30">
                  <td className="px-4 py-4">
                    <div className="font-medium">
                      <Link href={`/app/admin/integrations/deliveries/${item.id}`} className="hover:underline">
                        {item.event}
                      </Link>
                    </div>
                    <div className="text-xs text-muted-foreground">#{item.id} • retries {item.retry_count}</div>
                    {item.last_error ? (
                      <div className="text-xs text-muted-foreground mt-1">{item.last_error.slice(0, 120)}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-4 text-xs text-muted-foreground">
                    <div>{item.endpoint?.org?.name || '-'}</div>
                    <div className="truncate max-w-[320px]">{item.endpoint?.endpoint_url || item.endpoint_id}</div>
                  </td>
                  <td className="px-4 py-4">
                    <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                  </td>
                  <td className="px-4 py-4">
                    <AdminObjectSummary value={item.payload} />
                  </td>
                  <td className="px-4 py-4 text-xs text-muted-foreground">{formatDateTime(item.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </AdminTable>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Page {deliveryPage}</span>
          <div className="flex items-center gap-2">
            {deliveryPage <= 1 ? (
              <span className="px-4 py-2 text-xs text-muted-foreground">Précédent</span>
            ) : (
              <Button asChild variant="secondary" size="sm">
                <Link href={`/app/admin/integrations?${deliveryPrev.toString()}`}>Précédent</Link>
              </Button>
            )}
            {deliveryPage >= Math.max(1, Math.ceil(deliveries.pagination.total / 20)) ? (
              <span className="px-4 py-2 text-xs text-muted-foreground">Suivant</span>
            ) : (
              <Button asChild variant="secondary" size="sm">
                <Link href={`/app/admin/integrations?${deliveryNext.toString()}`}>Suivant</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
