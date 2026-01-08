import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronLeft, ListChecks, Webhook } from 'lucide-react';

import { fetchAdminApi } from '@/lib/admin/request';
import { hasAdminPermission, requireAdminPermission } from '@/lib/admin/rbac';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminObjectSummary } from '@/components/admin/admin-object-summary';
import { AdminWebhookDeliveryActions } from '@/components/admin/admin-webhook-delivery-actions';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
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

  const endpointLabel = delivery.endpoint?.endpoint_url || delivery.endpoint_id;
  const orgLabel = delivery.endpoint?.org?.name || delivery.endpoint?.org_id || '-';
  const emailLabel = delivery.endpoint?.org?.billing_email || '-';

  return (
    <section className="space-y-8">
      <AdminPageHeader
        title="Webhook delivery"
        description={`#${delivery.id}`}
        icon={<Webhook className="h-5 w-5" />}
        badges={
          <>
            <Badge variant={statusVariant(delivery.status)}>{delivery.status}</Badge>
            <Badge variant="secondary">Event {delivery.event}</Badge>
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/app/admin/integrations" className="flex items-center gap-2">
                <ChevronLeft className="h-4 w-4" />
                Back to integrations
              </Link>
            </Button>
            <AdminWebhookDeliveryActions
              deliveryId={delivery.id}
              canRetry={canWrite && delivery.status !== 'success'}
            />
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{delivery.status}</div>
            <Badge variant={statusVariant(delivery.status)}>State</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Retries</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{delivery.retry_count}</div>
            <Badge variant="secondary">Attempt</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Updated</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{formatDateTime(delivery.updated_at)}</div>
            <Badge variant="secondary">Last update</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Endpoint</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold truncate max-w-[200px]" title={endpointLabel}>
              {endpointLabel}
            </div>
            <Badge variant="secondary">Org {orgLabel === '-' ? '-' : 'linked'}</Badge>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Delivery details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={statusVariant(delivery.status)}>{delivery.status}</Badge>
              <Badge variant="secondary">Event {delivery.event}</Badge>
              <Badge variant="secondary">Retries {delivery.retry_count}</Badge>
            </div>

            {delivery.last_error ? (
              <div className="rounded-2xl border border-border bg-destructive/5 p-4">
                <div className="text-sm font-semibold">Last error</div>
                <div className="mt-1 text-xs text-muted-foreground">{delivery.last_error}</div>
              </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-2 text-xs text-muted-foreground">
              <div>
                <div className="font-medium text-foreground">Created</div>
                <div>{formatDateTime(delivery.created_at)}</div>
              </div>
              <div>
                <div className="font-medium text-foreground">Updated</div>
                <div>{formatDateTime(delivery.updated_at)}</div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-muted/30 p-4">
              <div className="text-sm font-semibold">Endpoint</div>
              <div className="mt-2 text-xs text-muted-foreground space-y-1">
                <div className="font-medium text-foreground truncate">{endpointLabel}</div>
                <div>Org: {orgLabel}</div>
                <div>Email: {emailLabel}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payload summary</CardTitle>
          </CardHeader>
          <CardContent>
            <AdminObjectSummary value={delivery.payload} maxItems={10} />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <SectionHeader
          icon={<ListChecks className="h-5 w-5" />}
          title="Recent deliveries"
          subtitle="Latest deliveries for the same endpoint."
        />
        <Card>
          <CardContent className="space-y-2 pt-6">
            {timelineItems.length === 0 ? (
              <div className="text-sm text-muted-foreground">No delivery data.</div>
            ) : (
              <div className="space-y-2">
                {timelineItems.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-card p-3"
                  >
                    <div className="space-y-1">
                      <div className="font-medium">
                        <Link href={`/app/admin/integrations/deliveries/${d.id}`} className="hover:underline">
                          {d.event}
                        </Link>
                      </div>
                      {d.last_error ? (
                        <div className="text-xs text-muted-foreground">{d.last_error.slice(0, 160)}</div>
                      ) : null}
                      <div className="text-xs text-muted-foreground">{formatDateTime(d.created_at)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={statusVariant(d.status)}>{d.status}</Badge>
                      <Badge variant="secondary">{d.retry_count} retries</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
