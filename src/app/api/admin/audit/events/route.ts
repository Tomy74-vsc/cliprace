import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { createError, formatErrorResponse } from '@/lib/errors';

const QuerySchema = z.object({
  event_name: z.string().optional(),
  user_id: z.string().uuid().optional(),
  org_id: z.string().uuid().optional(),
  q: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  page: z.coerce.number().min(1).default(1),
});

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  try {
    await requireAdminPermission('audit.read');
    const parsed = QuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
    const query = parsed.success ? parsed.data : QuerySchema.parse({});
    const limit = query.limit;
    const from = (query.page - 1) * limit;
    const to = from + limit - 1;

    const admin = getAdminClient();
    let eventsQuery = admin
      .from('event_log')
      .select(
        'id, user_id, org_id, event_name, properties, created_at, user:profiles(id, display_name, email), org:orgs(id, name)',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    if (query.event_name) {
      eventsQuery = eventsQuery.eq('event_name', query.event_name);
    }
    if (query.user_id) {
      eventsQuery = eventsQuery.eq('user_id', query.user_id);
    }
    if (query.org_id) {
      eventsQuery = eventsQuery.eq('org_id', query.org_id);
    }
    if (query.q) {
      const trimmed = query.q.trim();
      if (uuidPattern.test(trimmed)) {
        eventsQuery = eventsQuery.or(`user_id.eq.${trimmed},org_id.eq.${trimmed}`);
      } else {
        const like = `%${trimmed}%`;
        eventsQuery = eventsQuery.ilike('event_name', like);
      }
    }

    const { data: items, error, count } = await eventsQuery;
    if (error) {
      throw createError('DATABASE_ERROR', 'Failed to load events', 500, error.message);
    }

    return NextResponse.json({
      items: items ?? [],
      pagination: { total: count ?? 0, page: query.page, limit },
    });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
