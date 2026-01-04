import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { assertCsrf } from '@/lib/csrf';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { createError, formatErrorResponse } from '@/lib/errors';

const BodySchema = z.object({
  note: z.string().min(2).max(2000),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { user } = await requireAdminPermission('support.write');
    await enforceAdminRateLimit(req, { route: 'admin:support:tickets:note', max: 60, windowMs: 60_000 });
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

    const admin = getAdminClient();
    const { data: ticket, error: ticketError } = await admin
      .from('support_tickets')
      .select('id, internal_notes')
      .eq('id', id)
      .single();

    if (ticketError || !ticket) {
      throw createError('NOT_FOUND', 'Ticket not found', 404, ticketError?.message);
    }

    const now = new Date().toISOString();
    const entry = `[${now}] ${user.id}: ${parsed.data.note.trim()}`;
    const nextNotes = ticket.internal_notes
      ? `${ticket.internal_notes}\n${entry}`
      : entry;

    const { error: updateError } = await admin
      .from('support_tickets')
      .update({ internal_notes: nextNotes, updated_at: now })
      .eq('id', id);

    if (updateError) {
      throw createError('DATABASE_ERROR', 'Failed to append note', 500, updateError.message);
    }

    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'support_note_add',
      table_name: 'support_tickets',
      row_pk: id,
      new_values: { note_preview: parsed.data.note.slice(0, 120) },
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
