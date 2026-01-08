import { NextResponse } from 'next/server';

import { requireAdminUser } from '@/lib/admin/guard';
import { getAdminMfaRow, isAdminMfaRequired, readAdminMfaVerifiedCookie } from '@/lib/admin/mfa';

export async function GET() {
  const user = await requireAdminUser();

  const required = isAdminMfaRequired();
  const row = await getAdminMfaRow(user.id);
  const verified = await readAdminMfaVerifiedCookie(user.id);

  return NextResponse.json({
    ok: true,
    required,
    enrolled: Boolean(row?.secret_enc),
    enabled: Boolean(row?.is_enabled),
    verified: Boolean(row?.is_enabled && verified),
  });
}

