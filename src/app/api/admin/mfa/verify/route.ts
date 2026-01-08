import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticator } from 'otplib';

import { requireAdminUser } from '@/lib/admin/guard';
import { getAdminClient } from '@/lib/admin/supabase';
import { assertCsrf } from '@/lib/csrf';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { auditAdminAction } from '@/lib/admin/audit-enhanced';
import { buildAdminMfaCookieValue, decryptAdminTotpSecret, getAdminMfaRow } from '@/lib/admin/mfa';
import { createError, formatErrorResponse } from '@/lib/errors';

const BodySchema = z.object({
  code: z.string().trim().min(6).max(12),
});

function currentStep(stepSeconds = 30) {
  return Math.floor(Date.now() / (stepSeconds * 1000));
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAdminUser();
    await enforceAdminRateLimit(req, { route: 'admin:mfa:verify', max: 20, windowMs: 60_000 }, user.id);

    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch (csrfError) {
      throw createError('FORBIDDEN', 'Invalid CSRF token', 403, csrfError);
    }

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      throw createError('VALIDATION_ERROR', 'Invalid payload', 400, parsed.error.flatten());
    }

    const row = await getAdminMfaRow(user.id);
    if (!row?.secret_enc) {
      throw createError('NOT_FOUND', 'MFA not enrolled', 404);
    }

    const secret = decryptAdminTotpSecret(row.secret_enc);
    authenticator.options = { window: 1, step: 30 };

    const code = parsed.data.code.replace(/\s+/g, '');
    const checkDeltaFn = (authenticator as unknown as { checkDelta?: (token: string, secret: string) => number | null })
      .checkDelta;
    const delta = typeof checkDeltaFn === 'function' ? checkDeltaFn(code, secret) : authenticator.check(code, secret) ? 0 : null;

    if (delta === null) {
      throw createError('FORBIDDEN', 'Invalid code', 403);
    }

    const step = currentStep(30) + delta;
    if (row.last_used_step !== null && step <= row.last_used_step) {
      throw createError('FORBIDDEN', 'Code already used', 403);
    }

    const now = new Date().toISOString();
    const admin = getAdminClient();
    const { error: updateError } = await admin
      .from('admin_mfa')
      .update({ is_enabled: true, verified_at: now, last_used_step: step, updated_at: now })
      .eq('user_id', user.id);

    if (updateError) {
      const code = String((updateError as UnsafeAny)?.code || '').toUpperCase();
      if (code === '42P01') {
        throw createError(
          'CONFIG_ERROR',
          'admin_mfa table is missing (apply db_refonte/54_admin_mfa.sql)',
          500,
          updateError.message
        );
      }
      throw createError('DATABASE_ERROR', 'Failed to verify MFA', 500, updateError.message);
    }

    await auditAdminAction({
      actorId: user.id,
      action: 'admin_mfa_verify',
      entity: 'admin_mfa',
      entityId: user.id,
      before: { is_enabled: row.is_enabled },
      after: { is_enabled: true },
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      userAgent: req.headers.get('user-agent') ?? undefined,
    });

    const res = NextResponse.json({ ok: true });
    const cookieValue = buildAdminMfaCookieValue(user.id, 60 * 60 * 12);
    const secure = process.env.NODE_ENV === 'production';
    res.cookies.set('admin_mfa_verified', cookieValue, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/',
      maxAge: 60 * 60 * 12,
    });
    return res;
  } catch (error) {
    return formatErrorResponse(error);
  }
}
