import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { assertAdminBreakGlass } from '@/lib/admin/break-glass';
import { assertCsrf } from '@/lib/csrf';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { createError, formatErrorResponse } from '@/lib/errors';
import { mapPostgrestError } from '@/lib/admin/errors';

const QuerySchema = z.object({
  q: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  page: z.coerce.number().min(1).default(1),
});

const CreateSchema = z.object({
  key: z.string().min(2).max(120),
  value: z.any(),
  description: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  try {
    await requireAdminPermission('settings.read');
    const parsed = QuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
    const query = parsed.success ? parsed.data : QuerySchema.parse({});
    const limit = query.limit;
    const from = (query.page - 1) * limit;
    const to = from + limit - 1;

    const admin = getAdminClient();
    let settingsQuery = admin
      .from('platform_settings')
      .select('key, value, description, created_at, updated_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (query.q) {
      const like = `%${query.q}%`;
      settingsQuery = settingsQuery.or(`key.ilike.${like},description.ilike.${like}`);
    }

    const { data: items, error, count } = await settingsQuery;
    if (error) {
      throw createError('DATABASE_ERROR', 'Failed to load settings', 500, error.message);
    }

    return NextResponse.json({
      items: items ?? [],
      pagination: { total: count ?? 0, page: query.page, limit },
    });
  } catch (error) {
    return formatErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAdminPermission('settings.write');
    await enforceAdminRateLimit(req, { route: 'admin:settings:create', max: 10, windowMs: 60_000 });
    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch (csrfError) {
      throw createError('FORBIDDEN', 'Invalid CSRF token', 403, csrfError);
    }

    const breakGlass = assertAdminBreakGlass(req, 'settings.write');

    const body = await req.json();
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      throw createError('VALIDATION_ERROR', 'Invalid payload', 400, parsed.error.flatten());
    }

    const admin = getAdminClient();
    const now = new Date().toISOString();
    const { error } = await admin
      .from('platform_settings')
      .insert({
        key: parsed.data.key,
        value: parsed.data.value ?? null,
        description: parsed.data.description ?? null,
        created_at: now,
        updated_at: now,
      });

    const mapped = mapPostgrestError(error, 'Failed to create setting');
    if (mapped) throw mapped;

    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'setting_create',
      table_name: 'platform_settings',
      row_pk: parsed.data.key,
      new_values: { key: parsed.data.key, ...(breakGlass.required ? { break_glass: breakGlass } : {}) },
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
