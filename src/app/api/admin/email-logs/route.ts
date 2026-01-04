import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { createError, formatErrorResponse } from '@/lib/errors';

const QuerySchema = z.object({
  status: z.string().optional(),
  outbox_id: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  page: z.coerce.number().min(1).default(1),
});

export async function GET(req: NextRequest) {
  try {
    await requireAdminPermission('emails.read');
    const parsed = QuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
    const query = parsed.success ? parsed.data : QuerySchema.parse({});
    const limit = query.limit;
    const from = (query.page - 1) * limit;
    const to = from + limit - 1;

    const admin = getAdminClient();
    let logsQuery = admin
      .from('email_logs')
      .select(
        'id, outbox_id, status, provider, provider_message_id, error_message, created_at',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    if (query.status) {
      logsQuery = logsQuery.eq('status', query.status);
    }
    if (query.outbox_id) {
      logsQuery = logsQuery.eq('outbox_id', query.outbox_id);
    }

    const { data: logs, error, count } = await logsQuery;
    if (error) {
      throw createError('DATABASE_ERROR', 'Failed to load email logs', 500, error.message);
    }

    return NextResponse.json({
      items: logs ?? [],
      pagination: { total: count ?? 0, page: query.page, limit },
    });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
