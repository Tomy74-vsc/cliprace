import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { createError, formatErrorResponse } from '@/lib/errors';

const QuerySchema = z.object({
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  resolved: z.preprocess((value) => {
    if (value === '' || value === undefined) return undefined;
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  }, z.boolean().optional()),
  user_id: z.string().uuid().optional(),
  q: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  page: z.coerce.number().min(1).default(1),
});

export async function GET(req: NextRequest) {
  try {
    await requireAdminPermission('risk.read');
    const parsed = QuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
    const query = parsed.success ? parsed.data : QuerySchema.parse({});
    const limit = query.limit;
    const from = (query.page - 1) * limit;
    const to = from + limit - 1;

    const admin = getAdminClient();
    let flagsQuery = admin
      .from('risk_flags')
      .select('id, user_id, reason, severity, resolved_at, created_at, updated_at, user:profiles(id, display_name, email)', {
        count: 'exact',
      })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (query.severity) flagsQuery = flagsQuery.eq('severity', query.severity);
    if (typeof query.resolved === 'boolean') {
      flagsQuery = query.resolved ? flagsQuery.not('resolved_at', 'is', null) : flagsQuery.is('resolved_at', null);
    }
    if (query.user_id) flagsQuery = flagsQuery.eq('user_id', query.user_id);
    if (query.q) {
      const like = `%${query.q.trim()}%`;
      flagsQuery = flagsQuery.or(`reason.ilike.${like},severity.ilike.${like}`);
    }

    const { data: items, error, count } = await flagsQuery;
    if (error) {
      throw createError('DATABASE_ERROR', 'Failed to load risk flags', 500, error.message);
    }

    return NextResponse.json({
      items: items ?? [],
      pagination: { total: count ?? 0, page: query.page, limit },
    });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
