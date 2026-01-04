import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { assertCsrf } from '@/lib/csrf';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { createError, formatErrorResponse } from '@/lib/errors';

const QuerySchema = z.object({
  status: z.string().optional(),
  assigned_to: z.string().uuid().optional(),
  q: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  page: z.coerce.number().min(1).default(1),
});

const StatusEnum = z.enum(['new', 'contacted', 'qualified', 'proposal', 'won', 'lost']);

const CreateSchema = z.object({
  name: z.string().min(2).max(200),
  email: z.string().email().optional().nullable(),
  company: z.string().optional().nullable(),
  status: StatusEnum.optional(),
  source: z.string().optional().nullable(),
  value_cents: z.coerce.number().int().min(0).optional(),
  assigned_to: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const STATUSES = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'] as const;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  try {
    await requireAdminPermission('crm.read');
    const parsed = QuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
    const query = parsed.success ? parsed.data : QuerySchema.parse({});
    const limit = query.limit;
    const from = (query.page - 1) * limit;
    const to = from + limit - 1;

    const admin = getAdminClient();
    let leadsQuery = admin
      .from('sales_leads')
      .select(
        'id, name, email, company, status, source, value_cents, assigned_to, notes, created_at, updated_at, assigned:profiles(id, display_name, email)',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    if (query.status) {
      leadsQuery = leadsQuery.eq('status', query.status);
    }
    if (query.assigned_to) {
      leadsQuery = leadsQuery.eq('assigned_to', query.assigned_to);
    }
    if (query.q) {
      const trimmed = query.q.trim();
      if (uuidPattern.test(trimmed)) {
        leadsQuery = leadsQuery.eq('id', trimmed);
      } else {
        const like = `%${trimmed}%`;
        leadsQuery = leadsQuery.or(`name.ilike.${like},email.ilike.${like},company.ilike.${like}`);
      }
    }

    const { data: leads, error, count } = await leadsQuery;
    if (error) {
      throw createError('DATABASE_ERROR', 'Failed to load leads', 500, error.message);
    }

    const statusCounts: Record<string, number> = {};
    await Promise.all(
      STATUSES.map(async (status) => {
        const { count: statusCount, error: statusError } = await admin
          .from('sales_leads')
          .select('id', { count: 'exact', head: true })
          .eq('status', status);
        if (statusError) {
          throw createError('DATABASE_ERROR', 'Failed to load lead stats', 500, statusError.message);
        }
        statusCounts[status] = statusCount ?? 0;
      })
    );

    return NextResponse.json({
      items: leads ?? [],
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
    const { user } = await requireAdminPermission('crm.write');
    await enforceAdminRateLimit(req, { route: 'admin:crm:leads:create', max: 30, windowMs: 60_000 });
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
      .from('sales_leads')
      .insert({
        name: parsed.data.name,
        email: parsed.data.email ?? null,
        company: parsed.data.company ?? null,
        status: parsed.data.status ?? 'new',
        source: parsed.data.source ?? null,
        value_cents: parsed.data.value_cents ?? 0,
        assigned_to: parsed.data.assigned_to ?? null,
        notes: parsed.data.notes ?? null,
        created_at: now,
        updated_at: now,
      })
      .select('id')
      .single();

    if (error) {
      throw createError('DATABASE_ERROR', 'Failed to create lead', 500, error.message);
    }

    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'lead_create',
      table_name: 'sales_leads',
      row_pk: inserted?.id ?? null,
      new_values: { name: parsed.data.name, status: parsed.data.status ?? 'new' },
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({ ok: true, id: inserted?.id ?? null });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
