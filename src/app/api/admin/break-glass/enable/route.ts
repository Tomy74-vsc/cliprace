import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { assertCsrf } from '@/lib/csrf';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { auditAdminAction } from '@/lib/admin/audit-enhanced';
import { enableAdminBreakGlass, isAdminBreakGlassRequired } from '@/lib/admin/break-glass';
import { createError, formatErrorResponse } from '@/lib/errors';

const BodySchema = z.object({
  permission: z.string(),
  ttl_minutes: z.coerce.number().int().min(1).max(120).default(30),
  reason: z.string().min(8).max(500),
  reason_code: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAdminPermission('settings.write'); // Permission pour activer break-glass
    // Note: break-glass peut être activé même en read-only (c'est une exception)
    await enforceAdminRateLimit(req, { route: 'admin:break-glass:enable', max: 10, windowMs: 60_000 }, user.id);
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

    const { permission, ttl_minutes, reason, reason_code } = parsed.data;

    // Vérifier que la permission nécessite break-glass
    if (!isAdminBreakGlassRequired(permission)) {
      throw createError('VALIDATION_ERROR', 'Cette permission ne nécessite pas de break-glass', 400);
    }

    // Activer break-glass
    const { expires_at } = await enableAdminBreakGlass(user.id, ttl_minutes, reason);

    // Audit
    await auditAdminAction({
      actorId: user.id,
      action: 'admin_break_glass_enable',
      entity: 'admin_staff',
      entityId: user.id,
      before: null,
      after: {
        permission,
        ttl_minutes,
        expires_at,
      },
      reason,
      reasonCode: reason_code,
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      userAgent: req.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({
      ok: true,
      expires_at,
      ttl_minutes,
    });
  } catch (error) {
    return formatErrorResponse(error);
  }
}

