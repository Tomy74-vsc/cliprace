import { NextRequest, NextResponse } from 'next/server';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';

import { requireAdminUser } from '@/lib/admin/guard';
import { getAdminClient } from '@/lib/admin/supabase';
import { assertCsrf } from '@/lib/csrf';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { auditAdminAction } from '@/lib/admin/audit-enhanced';
import { createError, formatErrorResponse } from '@/lib/errors';
import { encryptAdminTotpSecret, getAdminMfaRow } from '@/lib/admin/mfa';

export async function POST(req: NextRequest) {
  try {
    const user = await requireAdminUser();
    await enforceAdminRateLimit(req, { route: 'admin:mfa:enroll', max: 5, windowMs: 60_000 }, user.id);

    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch (csrfError) {
      throw createError('FORBIDDEN', 'Invalid CSRF token', 403, csrfError);
    }

    const existing = await getAdminMfaRow(user.id);
    if (existing?.is_enabled) {
      throw createError('VALIDATION_ERROR', 'MFA already enabled', 400);
    }

    const secret = authenticator.generateSecret();
    const issuer = 'ClipRace';
    const label = `admin:${user.email}`;
    const otpauthUrl = authenticator.keyuri(label, issuer, secret);
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { errorCorrectionLevel: 'M', margin: 1, scale: 6 });

    const now = new Date().toISOString();
    const admin = getAdminClient();
    const secretEnc = encryptAdminTotpSecret(secret);

    const { error } = await admin
      .from('admin_mfa')
      .upsert(
        {
          user_id: user.id,
          secret_enc: secretEnc,
          is_enabled: false,
          verified_at: null,
          last_used_step: null,
          updated_at: now,
        },
        { onConflict: 'user_id' }
      );

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
      throw createError('DATABASE_ERROR', 'Failed to enroll MFA', 500, error.message);
    }

    await auditAdminAction({
      actorId: user.id,
      action: 'admin_mfa_enroll',
      entity: 'admin_mfa',
      entityId: user.id,
      before: null,
      after: { is_enabled: false },
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      userAgent: req.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({
      ok: true,
      secret,
      otpauth_url: otpauthUrl,
      qr_data_url: qrDataUrl,
    });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
