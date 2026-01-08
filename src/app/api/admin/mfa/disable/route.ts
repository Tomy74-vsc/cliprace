import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { assertCsrf } from '@/lib/csrf';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { auditAdminAction } from '@/lib/admin/audit-enhanced';
import { createError, formatErrorResponse } from '@/lib/errors';

const BodySchema = z.object({
  reason: z.string().trim().min(8).max(500),
});

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAdminPermission('settings.write');
    await enforceAdminRateLimit(req, { route: 'admin:mfa:disable', max: 5, windowMs: 60_000 }, user.id);

    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch (csrfError) {
      throw createError('FORBIDDEN', 'Invalid CSRF token', 403, csrfError);
    }

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      throw createError('VALIDATION_ERROR', 'Invalid payload', 400, parsed.error.flatten());
    }

    const admin = getAdminClient();
    const { error } = await admin.from('admin_mfa').delete().eq('user_id', user.id);
    if (error) {
      const code = String((error as UnsafeAny)?.code || '').toUpperCase();
      if (code === '42P01') {
        throw createError(
          'CONFIG_ERROR',
          'admin_mfa table is missing (apply db_refonte/54_admin_mfa.sql)',
          500,
          error.message
        );
      }
      throw createError('DATABASE_ERROR', 'Failed to disable MFA', 500, error.message);
    }

    await auditAdminAction({
      actorId: user.id,
      action: 'admin_mfa_disable',
      entity: 'admin_mfa',
      entityId: user.id,
      before: { is_enabled: true },
      after: { is_enabled: false },
      reason: parsed.data.reason,
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      userAgent: req.headers.get('user-agent') ?? undefined,
    });

    const res = NextResponse.json({ ok: true });
    res.cookies.set('admin_mfa_verified', '', { path: '/', maxAge: 0 });
    return res;
  } catch (error) {
    return formatErrorResponse(error);
  }
}
