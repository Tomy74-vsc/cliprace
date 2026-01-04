import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { createError, formatErrorResponse } from '@/lib/errors';

const QuerySchema = z.object({
  endpoint_id: z.string().uuid().optional(),
  org_id: z.string().uuid().optional(),
  status: z.enum(['pending', 'success', 'failed']).optional(),
  event: z.string().optional(),
  q: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  page: z.coerce.number().min(1).default(1),
});

type DeliveryRow = {
  id: number;
  endpoint_id: string;
  event: string;
  status: string;
  retry_count: number | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  payload: unknown;
  endpoint: {
    id: string;
    org_id: string;
    endpoint_url: string;
    org: { id: string; name: string | null } | null;
  } | null;
};

export async function GET(req: NextRequest) {
  try {
    await requireAdminPermission('integrations.read');
    const parsed = QuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
    const query = parsed.success ? parsed.data : QuerySchema.parse({});
    const limit = query.limit;
    const from = (query.page - 1) * limit;
    const to = from + limit - 1;

    const admin = getAdminClient();

    let orgEndpointIds: string[] | null = null;
    if (query.org_id && !query.endpoint_id) {
      const { data: endpoints, error: endpointError } = await admin
        .from('webhook_endpoints')
        .select('id')
        .eq('org_id', query.org_id);
      if (endpointError) {
        throw createError('DATABASE_ERROR', 'Failed to load webhook endpoints', 500, endpointError.message);
      }
      orgEndpointIds = (endpoints ?? []).map((row) => row.id);
      if (orgEndpointIds.length === 0) {
        return NextResponse.json({
          items: [],
          pagination: { total: 0, page: query.page, limit },
        });
      }
    }

    let deliveriesQuery = admin
      .from('webhook_deliveries')
      .select(
        'id, endpoint_id, event, status, retry_count, last_error, created_at, updated_at, payload, endpoint:webhook_endpoints(id, org_id, endpoint_url, org:orgs(id, name))',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    if (query.endpoint_id) deliveriesQuery = deliveriesQuery.eq('endpoint_id', query.endpoint_id);
    if (orgEndpointIds) deliveriesQuery = deliveriesQuery.in('endpoint_id', orgEndpointIds);
    if (query.status) deliveriesQuery = deliveriesQuery.eq('status', query.status);
    if (query.event) deliveriesQuery = deliveriesQuery.eq('event', query.event);
    if (query.q) {
      const like = `%${query.q.trim()}%`;
      deliveriesQuery = deliveriesQuery.or(`event.ilike.${like},last_error.ilike.${like}`);
    }

    const { data: items, error, count } = await deliveriesQuery;
    if (error) {
      throw createError('DATABASE_ERROR', 'Failed to load webhook deliveries', 500, error.message);
    }

    const rows = (items ?? []) as unknown as DeliveryRow[];

    return NextResponse.json({
      items: rows,
      pagination: { total: count ?? 0, page: query.page, limit },
    });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
