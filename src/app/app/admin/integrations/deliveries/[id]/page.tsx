import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronLeft, Webhook } from 'lucide-react';

import { fetchAdminApi } from '@/lib/admin/request';
import { hasAdminPermission, requireAdminPermission } from '@/lib/admin/rbac';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminObjectSummary } from '@/components/admin/admin-object-summary';
import { AdminWebhookDeliveryActions } from '@/components/admin/admin-webhook-delivery-actions';
import { formatDateTime } from '@/lib/formatters';

type DeliveryDetail = {
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
        active: boolean;
        org: { id: string; name: string | null; billing_email: string | null } | null;
      }
    | null;
};

type DeliveryListItem = {
  id: number;
  event: string;
  status: string;
  retry_count: number;
  last_error: string | null;
  created_at: string;
};

function statusVariant(status: string) {
  if (status === 'success') return 'success' as const;
  if (status === 'failed') return 'danger' as const;
  if (status === 'pending') return 'warning' as const;
  return 'default' as const;
}

export default async function AdminWebhookDeliveryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  let access: Awaited<ReturnType<typeof requireAdminPermission>>['access'];
  try {
    ({ access } = await requireAdminPermission('integrations.read'));
  } catch {
    redirect('/forbidden');
  }

  const canWrite = hasAdminPermission(access, 'integrations.write');

  const { id } = await params;
  const deliveryRes = await fetchAdminApi(`/api/admin/webhook-deliveries/${id}`, { cache: 'no-store' });
  if (!deliveryRes.ok) redirect('/app/admin/integrations');

  const delivery: DeliveryDetail = (await deliveryRes.json()).item as DeliveryDetail;

  const timelineRes = await fetchAdminApi(
    `/api/admin/webhook-deliveries?${new URLSearchParams({
      endpoint_id: delivery.endpoint_id,
      limit: '20',
      page: '1',
    }).toString()}`,
    { cache: 'no-store' }
  );
  const timelineItems: DeliveryListItem[] = timelineRes.ok
    ? ((await timelineRes.json()).items as DeliveryListItem[])
    : [];

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Button asChild variant="ghost" size="sm">
            <Link href="/app/admin/integrations" className="flex items-center gap-2">
              <ChevronLeft className="h-4 w-4" />
              Retour aux intégrations
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Webhook className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="display-2">Livraison webhook</h1>
              <div className="text-sm text-muted-foreground">#{delivery.id}</div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AdminWebhookDeliveryActions deliveryId={delivery.id} canRetry={canWrite && delivery.status !== 'success'} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Détails</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={statusVariant(delivery.status)}>{delivery.status}</Badge>
              <Badge variant="secondary">event: {delivery.event}</Badge>
              <Badge variant="secondary">retries: {delivery.retry_count}</Badge>
            </div>

            {delivery.last_error ? (
              <div className="rounded-2xl border border-border bg-destructive/5 p-4">
                <div className="text-sm font-semibold">Dernière erreur</div>
                <div className="mt-1 text-xs text-muted-foreground">{delivery.last_error}</div>
              </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-2 text-xs text-muted-foreground">
              <div>
                <div className="font-medium text-foreground">Créée</div>
                <div>{formatDateTime(delivery.created_at)}</div>
              </div>
              <div>
                <div className="font-medium text-foreground">Dernière mise à jour</div>
                <div>{formatDateTime(delivery.updated_at)}</div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-muted/30 p-4">
              <div className="text-sm font-semibold">Endpoint</div>
              <div className="mt-2 text-xs text-muted-foreground space-y-1">
                <div className="font-medium text-foreground truncate">{delivery.endpoint?.endpoint_url || delivery.endpoint_id}</div>
                <div>Org: {delivery.endpoint?.org?.name || delivery.endpoint?.org_id || '—'}</div>
                <div>Email: {delivery.endpoint?.org?.billing_email || '—'}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payload (résumé)</CardTitle>
          </CardHeader>
          <CardContent>
            <AdminObjectSummary value={delivery.payload} maxItems={10} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Timeline (dernieres livraisons endpoint)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {timelineItems.length === 0 ? (
            <div className="text-sm text-muted-foreground">Aucune donnée.</div>
          ) : (
            <div className="space-y-2">
              {timelineItems.map((d) => (
                <div key={d.id} className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-card p-3">
                  <div className="space-y-1">
                    <div className="font-medium">
                      <Link href={`/app/admin/integrations/deliveries/${d.id}`} className="hover:underline">
                        {d.event}
                      </Link>
                    </div>
                    {d.last_error ? <div className="text-xs text-muted-foreground">{d.last_error.slice(0, 160)}</div> : null}
                    <div className="text-xs text-muted-foreground">{formatDateTime(d.created_at)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusVariant(d.status)}>{d.status}</Badge>
                    <Badge variant="secondary">{d.retry_count} retry</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

