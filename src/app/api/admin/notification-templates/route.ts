import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { enforceNotReadOnly } from '@/lib/admin/middleware-readonly';
import { assertCsrf } from '@/lib/csrf';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { createError, formatErrorResponse } from '@/lib/errors';

const QuerySchema = z.object({
  channel: z.string().optional(),
  q: z.string().optional(),
  is_active: z.coerce.boolean().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  page: z.coerce.number().min(1).default(1),
});

const BodySchema = z.object({
  event_type: z.string().min(2).max(100),
  channel: z.enum(['email', 'push', 'inapp', 'sms']),
  subject: z.string().optional().nullable(),
  body_html: z.string().optional().nullable(),
  body_text: z.string().optional().nullable(),
  variables: z.record(z.string()).optional().nullable(),
  is_active: z.boolean().optional(),
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
    let templatesQuery = admin
      .from('notification_templates')
      .select(
        'id, event_type, channel, subject, body_html, body_text, variables, is_active, created_at, updated_at',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    if (query.channel) {
      templatesQuery = templatesQuery.eq('channel', query.channel);
    }
    if (query.q) {
      templatesQuery = templatesQuery.ilike('event_type', `%${query.q}%`);
    }
    if (typeof query.is_active === 'boolean') {
      templatesQuery = templatesQuery.eq('is_active', query.is_active);
    }

    const { data: templates, error, count } = await templatesQuery;
    if (error) {
      throw createError('DATABASE_ERROR', 'Failed to load templates', 500, error.message);
    }

    return NextResponse.json({
      items: templates ?? [],
      pagination: { total: count ?? 0, page: query.page, limit },
    });
  } catch (error) {
    return formatErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAdminPermission('emails.write');
    await enforceNotReadOnly(req, user.id);
    await enforceAdminRateLimit(req, { route: 'admin:notification-templates:create', max: 20, windowMs: 60_000 }, user.id);
    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch (csrfError) {
      throw createError('FORBIDDEN', 'Invalid CSRF token', 403, csrfError);
    }

    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      throw createError('VALIDATION_ERROR', 'Invalid payload', 400, parsed.error.flatten());
    }

    const admin = getAdminClient();
    const now = new Date().toISOString();
    const { data: inserted, error } = await admin
      .from('notification_templates')
      .insert({
        event_type: parsed.data.event_type,
        channel: parsed.data.channel,
        subject: parsed.data.subject ?? null,
        body_html: parsed.data.body_html ?? null,
        body_text: parsed.data.body_text ?? null,
        variables: parsed.data.variables ?? {},
        is_active: parsed.data.is_active ?? true,
        created_at: now,
        updated_at: now,
      })
      .select('id')
      .single();

    if (error) {
      throw createError('DATABASE_ERROR', 'Failed to create template', 500, error.message);
    }

    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'notification_template_create',
      table_name: 'notification_templates',
      row_pk: inserted?.id ?? null,
      new_values: { event_type: parsed.data.event_type, channel: parsed.data.channel },
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({ ok: true, id: inserted?.id ?? null });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
