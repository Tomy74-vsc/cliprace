import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { assertCsrf } from '@/lib/csrf';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { createError, formatErrorResponse } from '@/lib/errors';

export async function GET() {
  try {
    await requireAdminPermission('settings.read');
    const admin = getAdminClient();

    const { data: setting, error } = await admin
      .from('platform_settings')
      .select('value')
      .eq('key', 'admin_read_only')
      .maybeSingle();

    if (error) {
      throw createError('DATABASE_ERROR', 'Failed to load read-only setting', 500, error.message);
    }

    const value = setting?.value;
    const isReadOnly = typeof value === 'boolean' ? value : value === 'true' || value === true;

    return NextResponse.json({ ok: true, value: isReadOnly });
  } catch (error) {
    return formatErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAdminPermission('settings.write');
    await enforceAdminRateLimit(req, { route: 'admin:settings:readonly', max: 5, windowMs: 60_000 }, user.id);
    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch (csrfError) {
      throw createError('FORBIDDEN', 'Invalid CSRF token', 403, csrfError);
    }

    const admin = getAdminClient();

    const body = await req.json();
    const { value } = body;

    if (typeof value !== 'boolean') {
      throw createError('VALIDATION_ERROR', 'value must be boolean', 400);
    }

    const { error } = await admin
      .from('platform_settings')
      .upsert({
        key: 'admin_read_only',
        value: value,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      throw createError('DATABASE_ERROR', 'Failed to update read-only setting', 500, error.message);
    }

    return NextResponse.json({ ok: true, value });
  } catch (error) {
    return formatErrorResponse(error);
  }
}

