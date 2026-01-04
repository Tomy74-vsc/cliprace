import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { assertCsrf } from '@/lib/csrf';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { createError, formatErrorResponse } from '@/lib/errors';

const QuerySchema = z.object({
  route: z.string().min(1).max(200),
});

const CreateSchema = z.object({
  route: z.string().min(1).max(200),
  name: z.string().min(2).max(80),
  params: z.record(z.string()).default({}),
});

function isMissingTable(error: { message?: string; code?: string } | null | undefined) {
  const code = String(error?.code || '').toUpperCase();
  if (code === '42P01') return true;

  const msg = (error?.message || '').toLowerCase();
  if (!msg.includes('admin_saved_views')) return false;

  if (msg.includes('schema cache')) {
    return msg.includes('table') && !msg.includes('column');
  }

  return msg.includes('does not exist') || msg.includes('could not find');
}

export async function GET(req: NextRequest) {
  try {
    await requireAdminPermission('dashboard.read');
    await enforceAdminRateLimit(req, { route: 'admin:saved-views:list', max: 120, windowMs: 60_000 });

    const parsed = QuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
    if (!parsed.success) {
      throw createError('VALIDATION_ERROR', 'Paramètres invalides', 400, parsed.error.flatten());
    }

    const admin = getAdminClient();
    const { data, error } = await admin
      .from('admin_saved_views')
      .select('id, route, name, params, created_at, updated_at')
      .eq('route', parsed.data.route)
      .order('name', { ascending: true });

    if (error) {
      if (isMissingTable(error)) {
        return NextResponse.json({ ok: true, items: [], missing_table: true });
      }
      throw createError('DATABASE_ERROR', 'Impossible de charger les vues sauvegardées', 500, error.message);
    }

    return NextResponse.json({ ok: true, items: data ?? [], missing_table: false });
  } catch (error) {
    return formatErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAdminPermission('dashboard.read');
    await enforceAdminRateLimit(req, { route: 'admin:saved-views:create', max: 60, windowMs: 60_000 });
    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch (csrfError) {
      throw createError('FORBIDDEN', 'Jeton CSRF invalide', 403, csrfError);
    }

    const json = await req.json();
    const parsed = CreateSchema.safeParse(json);
    if (!parsed.success) {
      throw createError('VALIDATION_ERROR', 'Payload invalide', 400, parsed.error.flatten());
    }

    const admin = getAdminClient();
    const now = new Date().toISOString();
    const insertRow = {
      route: parsed.data.route,
      name: parsed.data.name,
      params: parsed.data.params,
      created_by: user.id,
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await admin
      .from('admin_saved_views')
      .insert(insertRow)
      .select('id, route, name, params, created_at, updated_at')
      .single();

    if (error) {
      if (isMissingTable(error)) {
        return NextResponse.json({ ok: false, missing_table: true }, { status: 200 });
      }
      throw createError('DATABASE_ERROR', 'Impossible de sauvegarder la vue', 500, error.message);
    }

    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'admin_saved_view_create',
      table_name: 'admin_saved_views',
      row_pk: data.id,
      new_values: { route: data.route, name: data.name, params: data.params },
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({ ok: true, item: data, missing_table: false });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
