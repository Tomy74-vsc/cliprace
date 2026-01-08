import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { assertAdminBreakGlass } from '@/lib/admin/break-glass';
import { assertCsrf } from '@/lib/csrf';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { enforceNotReadOnly } from '@/lib/admin/middleware-readonly';
import { createError, formatErrorResponse } from '@/lib/errors';
import { mapPostgrestError } from '@/lib/admin/errors';

const QuerySchema = z.object({
  q: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  page: z.coerce.number().min(1).default(1),
});

const CreateSchema = z.object({
  key: z.string().min(2).max(120),
  description: z.string().optional().nullable(),
  is_enabled: z.boolean().optional(),
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
    let flagsQuery = admin
      .from('feature_flags')
      .select('key, description, is_enabled, created_at, updated_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (query.q) {
      const like = `%${query.q}%`;
      flagsQuery = flagsQuery.or(`key.ilike.${like},description.ilike.${like}`);
    }

    const { data: items, error, count } = await flagsQuery;
    if (error) {
      throw createError('DATABASE_ERROR', 'Failed to load feature flags', 500, error.message);
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
    await enforceNotReadOnly(req, user.id);
    await enforceAdminRateLimit(req, { route: 'admin:feature-flags:create', max: 10, windowMs: 60_000 }, user.id);
    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch (csrfError) {
      throw createError('FORBIDDEN', 'Invalid CSRF token', 403, csrfError);
    }

    const breakGlass = await assertAdminBreakGlass(req, 'settings.write', user.id);

    const body = await req.json();
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      throw createError('VALIDATION_ERROR', 'Invalid payload', 400, parsed.error.flatten());
    }

    const admin = getAdminClient();
    const now = new Date().toISOString();
    const { error } = await admin
      .from('feature_flags')
      .insert({
        key: parsed.data.key,
        description: parsed.data.description ?? null,
        is_enabled: parsed.data.is_enabled ?? false,
        created_at: now,
        updated_at: now,
      });

    const mapped = mapPostgrestError(error, 'Failed to create flag');
    if (mapped) throw mapped;

    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'feature_flag_create',
      table_name: 'feature_flags',
      row_pk: parsed.data.key,
      new_values: {
        key: parsed.data.key,
        is_enabled: parsed.data.is_enabled ?? false,
        ...(breakGlass.required ? { break_glass: breakGlass } : {}),
      },
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
