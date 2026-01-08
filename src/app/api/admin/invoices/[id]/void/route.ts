import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { assertCsrf } from '@/lib/csrf';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { enforceNotReadOnly } from '@/lib/admin/middleware-readonly';
import { invoiceValidators } from '@/lib/admin/validators';
import { notifyAdminAction } from '@/lib/admin/notifications';
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
    const { user } = await requireAdminPermission('invoices.write');
    await enforceNotReadOnly(req, user.id);
    await enforceAdminRateLimit(req, { route: 'admin:invoices:void', max: 10, windowMs: 60_000 }, user.id);
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

    // Validation métier
    const validation = await invoiceValidators.canVoid(id);
    if (!validation.valid) {
      throw createError(
        'VALIDATION_ERROR',
        'Cannot void invoice',
        400,
        { errors: validation.errors }
      );
    }

    const admin = getAdminClient();
    const { data: invoice, error: invoiceError } = await admin
      .from('invoices')
      .select('id, status')
      .eq('id', id)
      .single();

    if (invoiceError || !invoice) {
      throw createError('NOT_FOUND', 'Invoice not found', 404, invoiceError?.message);
    }

    const now = new Date().toISOString();
    const { error: updateError } = await admin
      .from('invoices')
      .update({ status: 'void', updated_at: now })
      .eq('id', id);

    if (updateError) {
      throw createError('DATABASE_ERROR', 'Failed to void invoice', 500, updateError.message);
    }

    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'invoice_void',
      table_name: 'invoices',
      row_pk: id,
      old_values: { status: invoice.status },
      new_values: { status: 'void', reason: parsed.data.reason },
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    await admin.from('status_history').insert({
      table_name: 'invoices',
      row_id: id,
      old_status: invoice.status,
      new_status: 'void',
      changed_by: user.id,
      reason: parsed.data.reason,
    });

    // Notifier l'org owner
    const { data: invoiceFull } = await admin
      .from('invoices')
      .select('id, org_id')
      .eq('id', id)
      .single();

    if (invoiceFull?.org_id) {
      const { data: org } = await admin
        .from('orgs')
        .select('id, billing_email, owner_id')
        .eq('id', invoiceFull.org_id)
        .single();

      if (org) {
        let notifyUserId: string | null = org.owner_id || null;
        if (!notifyUserId && org.billing_email) {
          const { data: profile } = await admin
            .from('profiles')
            .select('id')
            .eq('email', org.billing_email)
            .single();
          notifyUserId = profile?.id || null;
        }

        if (notifyUserId) {
          await notifyAdminAction({
            userId: notifyUserId,
            type: 'invoice_voided',
            data: {
              invoice_id: id,
              reason: parsed.data.reason,
            },
          });
        }
      }
    }

    return NextResponse.json({ ok: true, status: 'void' });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
