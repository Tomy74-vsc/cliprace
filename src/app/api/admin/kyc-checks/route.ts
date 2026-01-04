import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { createError, formatErrorResponse } from '@/lib/errors';

const QuerySchema = z.object({
  status: z.enum(['pending', 'verified', 'failed']).optional(),
  provider: z.string().optional(),
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
    let kycQuery = admin
      .from('kyc_checks')
      .select('user_id, provider, status, reason, reviewed_at, created_at, updated_at, user:profiles(id, display_name, email)', {
        count: 'exact',
      })
      .order('updated_at', { ascending: false })
      .range(from, to);

    if (query.status) kycQuery = kycQuery.eq('status', query.status);
    if (query.provider) kycQuery = kycQuery.eq('provider', query.provider);
    if (query.user_id) kycQuery = kycQuery.eq('user_id', query.user_id);
    if (query.q) {
      const like = `%${query.q.trim()}%`;
      kycQuery = kycQuery.or(`reason.ilike.${like},provider.ilike.${like}`);
    }

    const { data: items, error, count } = await kycQuery;
    if (error) {
      throw createError('DATABASE_ERROR', 'Failed to load kyc checks', 500, error.message);
    }

    return NextResponse.json({
      items: items ?? [],
      pagination: { total: count ?? 0, page: query.page, limit },
    });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
