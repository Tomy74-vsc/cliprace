import { NextRequest } from 'next/server';
import { createError } from '@/lib/errors';

export type AdminBreakGlass = {
  required: boolean;
  confirmed: boolean;
  reason?: string;
};

const REQUIRED_HEADER = 'x-admin-break-glass-confirm';
const REASON_HEADER = 'x-admin-break-glass-reason';

export function isAdminBreakGlassRequired(permission: string) {
  return process.env.ADMIN_BREAK_GLASS_REQUIRED === '1' && ['finance.write', 'settings.write', 'admin.team.write'].includes(permission);
}

export function assertAdminBreakGlass(req: NextRequest, permission: string): AdminBreakGlass {
  if (!isAdminBreakGlassRequired(permission)) return { required: false, confirmed: false };

  const confirm = (req.headers.get(REQUIRED_HEADER) ?? '').trim();
  const reason = (req.headers.get(REASON_HEADER) ?? '').trim();

  if (confirm !== 'BREAK-GLASS' || reason.length < 3) {
    throw createError('FORBIDDEN', 'Confirmation break-glass requise', 403, {
      permission,
      required_header: REQUIRED_HEADER,
      reason_header: REASON_HEADER,
    });
  }

  return { required: true, confirmed: true, reason };
}

