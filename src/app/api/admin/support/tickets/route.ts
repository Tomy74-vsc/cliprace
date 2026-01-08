import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { assertCsrf } from '@/lib/csrf';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { enforceNotReadOnly } from '@/lib/admin/middleware-readonly';
import { createError, formatErrorResponse } from '@/lib/errors';

const QuerySchema = z.object({
  status: z.string().optional(),
  priority: z.string().optional(),
  assigned_to: z.string().uuid().optional(),
  q: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  page: z.coerce.number().min(1).default(1),
});

const StatusEnum = z.enum(['open', 'pending', 'resolved', 'closed']);
const PriorityEnum = z.enum(['low', 'medium', 'high', 'urgent']);

const CreateSchema = z
  .object({
    user_id: z.string().uuid().optional(),
    email: z.string().email().optional(),
    subject: z.string().min(3).max(200),
    status: StatusEnum.optional(),
    priority: PriorityEnum.optional(),
    assigned_to: z.string().uuid().optional().nullable(),
    internal_notes: z.string().optional().nullable(),
  })
  .refine((value) => Boolean(value.user_id || value.email), {
    message: 'Ticket must include user_id or email',
  });

const STATUSES = ['open', 'pending', 'resolved', 'closed'] as const;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  try {
    await requireAdminPermission('support.read');
    const parsed = QuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
    const query = parsed.success ? parsed.data : QuerySchema.parse({});
    const limit = query.limit;
    const from = (query.page - 1) * limit;
    const to = from + limit - 1;

    const admin = getAdminClient();
    let ticketsQuery = admin
      .from('support_tickets')
      .select(
        'id, user_id, email, subject, status, priority, assigned_to, internal_notes, created_at, updated_at, requester:profiles(id, display_name, email), assignee:profiles(id, display_name, email)',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    if (query.status) {
      ticketsQuery = ticketsQuery.eq('status', query.status);
    }
    if (query.priority) {
      ticketsQuery = ticketsQuery.eq('priority', query.priority);
    }
    if (query.assigned_to) {
      ticketsQuery = ticketsQuery.eq('assigned_to', query.assigned_to);
    }
    if (query.q) {
      const trimmed = query.q.trim();
      if (uuidPattern.test(trimmed)) {
        ticketsQuery = ticketsQuery.eq('id', trimmed);
      } else if (trimmed.includes('@')) {
        ticketsQuery = ticketsQuery.ilike('email', `%${trimmed}%`);
      } else {
        ticketsQuery = ticketsQuery.ilike('subject', `%${trimmed}%`);
      }
    }

    const { data: tickets, error, count } = await ticketsQuery;
    if (error) {
      throw createError('DATABASE_ERROR', 'Failed to load tickets', 500, error.message);
    }

    const statusCounts: Record<string, number> = {};
    await Promise.all(
      STATUSES.map(async (status) => {
        const { count: statusCount, error: statusError } = await admin
          .from('support_tickets')
          .select('id', { count: 'exact', head: true })
          .eq('status', status);
        if (statusError) {
          throw createError('DATABASE_ERROR', 'Failed to load ticket stats', 500, statusError.message);
        }
        statusCounts[status] = statusCount ?? 0;
      })
    );

    return NextResponse.json({
      items: tickets ?? [],
      pagination: {
        total: count ?? 0,
        page: query.page,
        limit,
      },
      stats: {
        total: count ?? 0,
        status_counts: statusCounts,
      },
    });
  } catch (error) {
    return formatErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAdminPermission('support.write');
    await enforceNotReadOnly(req, user.id);
    await enforceAdminRateLimit(req, { route: 'admin:support:tickets:create', max: 30, windowMs: 60_000 }, user.id);
    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch (csrfError) {
      throw createError('FORBIDDEN', 'Invalid CSRF token', 403, csrfError);
    }

    const body = await req.json();
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      throw createError('VALIDATION_ERROR', 'Invalid payload', 400, parsed.error.flatten());
    }

    const admin = getAdminClient();
    const now = new Date().toISOString();
    const { data: inserted, error } = await admin
      .from('support_tickets')
      .insert({
        user_id: parsed.data.user_id ?? null,
        email: parsed.data.email ?? null,
        subject: parsed.data.subject,
        status: parsed.data.status ?? 'open',
        priority: parsed.data.priority ?? 'medium',
        assigned_to: parsed.data.assigned_to ?? null,
        internal_notes: parsed.data.internal_notes ?? null,
        created_at: now,
        updated_at: now,
      })
      .select('id')
      .single();

    if (error) {
      throw createError('DATABASE_ERROR', 'Failed to create ticket', 500, error.message);
    }

    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'support_ticket_create',
      table_name: 'support_tickets',
      row_pk: inserted?.id ?? null,
      new_values: { subject: parsed.data.subject, status: parsed.data.status ?? 'open' },
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({ ok: true, id: inserted?.id ?? null });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
