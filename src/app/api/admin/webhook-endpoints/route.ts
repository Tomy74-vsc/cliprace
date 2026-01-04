import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { createError, formatErrorResponse } from '@/lib/errors';

const booleanParam = z.preprocess((value) => {
  if (value === '' || value === undefined) return undefined;
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
}, z.boolean().optional());

const QuerySchema = z.object({
  org_id: z.string().uuid().optional(),
  active: booleanParam,
  q: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  page: z.coerce.number().min(1).default(1),
});

export async function GET(req: NextRequest) {
  try {
    await requireAdminPermission('integrations.read');
    const parsed = QuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
    const query = parsed.success ? parsed.data : QuerySchema.parse({});
    const limit = query.limit;
    const from = (query.page - 1) * limit;
    const to = from + limit - 1;

    const admin = getAdminClient();
    let endpointsQuery = admin
      .from('webhook_endpoints')
      .select('id, org_id, endpoint_url, active, created_at, updated_at, org:orgs(id, name, billing_email)', {
        count: 'exact',
      })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (query.org_id) endpointsQuery = endpointsQuery.eq('org_id', query.org_id);
    if (typeof query.active === 'boolean') endpointsQuery = endpointsQuery.eq('active', query.active);
    if (query.q) {
      const like = `%${query.q.trim()}%`;
      endpointsQuery = endpointsQuery.or(`endpoint_url.ilike.${like}`);
    }

    const { data: items, error, count } = await endpointsQuery;
    if (error) {
      throw createError('DATABASE_ERROR', 'Failed to load webhook endpoints', 500, error.message);
    }

    return NextResponse.json({
      items: items ?? [],
      pagination: { total: count ?? 0, page: query.page, limit },
    });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
