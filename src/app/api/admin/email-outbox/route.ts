import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { createError, formatErrorResponse } from '@/lib/errors';

const QuerySchema = z.object({
  status: z.string().optional(),
  template_id: z.string().uuid().optional(),
  q: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  page: z.coerce.number().min(1).default(1),
});

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  try {
    await requireAdminPermission('emails.read');
    const parsed = QuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
    const query = parsed.success ? parsed.data : QuerySchema.parse({});
    const limit = query.limit;
    const from = (query.page - 1) * limit;
    const to = from + limit - 1;

    const admin = getAdminClient();
    let outboxQuery = admin
      .from('email_outbox')
      .select(
        'id, template_id, user_id, to_email, subject, status, provider, error_message, scheduled_at, sent_at, created_at, updated_at, template:notification_templates(id, event_type, channel), user:profiles(id, display_name, email)',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    if (query.status) {
      outboxQuery = outboxQuery.eq('status', query.status);
    }
    if (query.template_id) {
      outboxQuery = outboxQuery.eq('template_id', query.template_id);
    }
    if (query.q) {
      const trimmed = query.q.trim();
      if (trimmed.includes('@')) {
        outboxQuery = outboxQuery.ilike('to_email', `%${trimmed}%`);
      } else if (uuidPattern.test(trimmed)) {
        outboxQuery = outboxQuery.eq('user_id', trimmed);
      } else {
        outboxQuery = outboxQuery.ilike('subject', `%${trimmed}%`);
      }
    }

    const { data: items, error, count } = await outboxQuery;
    if (error) {
      throw createError('DATABASE_ERROR', 'Failed to load email outbox', 500, error.message);
    }

    return NextResponse.json({
      items: items ?? [],
      pagination: {
        total: count ?? 0,
        page: query.page,
        limit,
      },
    });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
