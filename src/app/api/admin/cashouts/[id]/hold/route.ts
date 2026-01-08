import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { assertAdminBreakGlass } from '@/lib/admin/break-glass';
import { assertCsrf } from '@/lib/csrf';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { enforceNotReadOnly } from '@/lib/admin/middleware-readonly';
import { cashoutValidators } from '@/lib/admin/validators';
import { createError, formatErrorResponse } from '@/lib/errors';

const BodySchema = z.object({
  reason: z.string().min(2).max(500),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { user } = await requireAdminPermission('finance.write');
    await enforceNotReadOnly(req, user.id);
    await enforceAdminRateLimit(req, { route: 'admin:cashouts:hold', max: 10, windowMs: 60_000 }, user.id);
    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch (csrfError) {
      throw createError('FORBIDDEN', 'Invalid CSRF token', 403, csrfError);
    }

    const breakGlass = await assertAdminBreakGlass(req, 'finance.write', user.id);

    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      throw createError('VALIDATION_ERROR', 'Invalid payload', 400, parsed.error.flatten());
    }

    // Validation métier
    const validation = await cashoutValidators.canHold(id);
    if (!validation.valid) {
      throw createError(
        'VALIDATION_ERROR',
        'Cannot hold cashout',
        400,
        { errors: validation.errors }
      );
    }

    const admin = getAdminClient();
    const { data: cashout, error: cashoutError } = await admin
      .from('cashouts')
      .select('id, status, metadata')
      .eq('id', id)
      .single();

    if (cashoutError || !cashout) {
      throw createError('NOT_FOUND', 'Cashout not found', 404, cashoutError?.message);
    }

    const now = new Date().toISOString();
    const metadata = {
      ...(cashout.metadata || {}),
      admin_action: 'hold',
      admin_reason: parsed.data.reason,
      on_hold: true,
    };

    const { error: updateError } = await admin
      .from('cashouts')
      .update({ status: 'processing', metadata, updated_at: now })
      .eq('id', id);

    if (updateError) {
      throw createError('DATABASE_ERROR', 'Failed to hold cashout', 500, updateError.message);
    }

    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'cashout_hold',
      table_name: 'cashouts',
      row_pk: id,
      old_values: { status: cashout.status },
      new_values: {
        status: 'processing',
        reason: parsed.data.reason,
        ...(breakGlass.required ? { break_glass: breakGlass } : {}),
      },
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    await admin.from('status_history').insert({
      table_name: 'cashouts',
      row_id: id,
      old_status: cashout.status,
      new_status: 'processing',
      changed_by: user.id,
      reason: parsed.data.reason,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
