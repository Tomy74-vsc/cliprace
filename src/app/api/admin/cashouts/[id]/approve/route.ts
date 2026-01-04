import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { assertAdminBreakGlass } from '@/lib/admin/break-glass';
import { assertCsrf } from '@/lib/csrf';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { createError, formatErrorResponse } from '@/lib/errors';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { user } = await requireAdminPermission('finance.write');
    await enforceAdminRateLimit(req, { route: 'admin:cashouts:approve', max: 10, windowMs: 60_000 });
    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch (csrfError) {
      throw createError('FORBIDDEN', 'Invalid CSRF token', 403, csrfError);
    }

    const breakGlass = assertAdminBreakGlass(req, 'finance.write');

    const admin = getAdminClient();
    const { data: cashout, error: cashoutError } = await admin
      .from('cashouts')
      .select('id, status, metadata')
      .eq('id', id)
      .single();

    if (cashoutError || !cashout) {
      throw createError('NOT_FOUND', 'Cashout not found', 404, cashoutError?.message);
    }

    if (!['requested', 'failed'].includes(cashout.status)) {
      throw createError('CONFLICT', `Cashout cannot be approved from ${cashout.status}`, 409);
    }

    const now = new Date().toISOString();
    const metadata = { ...(cashout.metadata || {}), admin_action: 'approve' };
    const { error: updateError } = await admin
      .from('cashouts')
      .update({ status: 'processing', metadata, updated_at: now })
      .eq('id', id);

    if (updateError) {
      throw createError('DATABASE_ERROR', 'Failed to approve cashout', 500, updateError.message);
    }

    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'cashout_approve',
      table_name: 'cashouts',
      row_pk: id,
      old_values: { status: cashout.status },
      new_values: { status: 'processing', ...(breakGlass.required ? { break_glass: breakGlass } : {}) },
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    await admin.from('status_history').insert({
      table_name: 'cashouts',
      row_id: id,
      old_status: cashout.status,
      new_status: 'processing',
      changed_by: user.id,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
