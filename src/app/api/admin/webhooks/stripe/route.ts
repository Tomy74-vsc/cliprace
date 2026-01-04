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
  event_type: z.string().optional(),
  processed: booleanParam,
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
    let webhooksQuery = admin
      .from('webhooks_stripe')
      .select(
        'id, stripe_event_id, event_type, processed, processed_at, created_at, payload',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    if (query.event_type) {
      webhooksQuery = webhooksQuery.eq('event_type', query.event_type);
    }
    if (typeof query.processed === 'boolean') {
      webhooksQuery = webhooksQuery.eq('processed', query.processed);
    }
    if (query.q) {
      const like = `%${query.q.trim()}%`;
      webhooksQuery = webhooksQuery.or(`stripe_event_id.ilike.${like},event_type.ilike.${like}`);
    }

    const { data: items, error, count } = await webhooksQuery;
    if (error) {
      throw createError('DATABASE_ERROR', 'Failed to load Stripe webhooks', 500, error.message);
    }

    return NextResponse.json({
      items: items ?? [],
      pagination: { total: count ?? 0, page: query.page, limit },
    });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
