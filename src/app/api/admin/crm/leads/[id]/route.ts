import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { enforceNotReadOnly } from '@/lib/admin/middleware-readonly';
import { assertCsrf } from '@/lib/csrf';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { createError, formatErrorResponse } from '@/lib/errors';

const StatusEnum = z.enum(['new', 'contacted', 'qualified', 'proposal', 'won', 'lost']);

const UpdateSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  email: z.string().email().nullable().optional(),
  company: z.string().nullable().optional(),
  status: StatusEnum.optional(),
  source: z.string().nullable().optional(),
  value_cents: z.coerce.number().int().min(0).optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  assign_to_me: z.boolean().optional(),
  notes: z.string().nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { user } = await requireAdminPermission('crm.write');
    await enforceNotReadOnly(req, user.id);
    await enforceAdminRateLimit(req, { route: 'admin:crm:leads:update', max: 30, windowMs: 60_000 }, user.id);
    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch (csrfError) {
      throw createError('FORBIDDEN', 'Invalid CSRF token', 403, csrfError);
    }

    const body = await req.json();
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw createError('VALIDATION_ERROR', 'Invalid payload', 400, parsed.error.flatten());
    }

    const admin = getAdminClient();
    const { data: lead, error: leadError } = await admin
      .from('sales_leads')
      .select('id, status, assigned_to')
      .eq('id', id)
      .single();

    if (leadError || !lead) {
      throw createError('NOT_FOUND', 'Lead not found', 404, leadError?.message);
    }

    const updates: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.assign_to_me) {
      updates.assigned_to = user.id;
      delete updates.assign_to_me;
    }
    delete updates.assign_to_me;
    updates.updated_at = new Date().toISOString();

    if (Object.keys(updates).length === 1) {
      return NextResponse.json({ ok: true });
    }

    const { error: updateError } = await admin
      .from('sales_leads')
      .update(updates)
      .eq('id', id);

    if (updateError) {
      throw createError('DATABASE_ERROR', 'Failed to update lead', 500, updateError.message);
    }

    if (parsed.data.status && parsed.data.status !== lead.status) {
      await admin.from('status_history').insert({
        table_name: 'sales_leads',
        row_id: id,
        old_status: lead.status,
        new_status: parsed.data.status,
        changed_by: user.id,
      });
    }

    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'lead_update',
      table_name: 'sales_leads',
      row_pk: id,
      old_values: { status: lead.status, assigned_to: lead.assigned_to },
      new_values: updates,
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return formatErrorResponse(error);
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { user } = await requireAdminPermission('crm.write');
    await enforceNotReadOnly(req, user.id);
    await enforceAdminRateLimit(req, { route: 'admin:crm:leads:delete', max: 30, windowMs: 60_000 }, user.id);
    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch (csrfError) {
      throw createError('FORBIDDEN', 'Invalid CSRF token', 403, csrfError);
    }

    const admin = getAdminClient();
    const { error } = await admin.from('sales_leads').delete().eq('id', id);
    if (error) {
      throw createError('DATABASE_ERROR', 'Failed to delete lead', 500, error.message);
    }

    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'lead_delete',
      table_name: 'sales_leads',
      row_pk: id,
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
