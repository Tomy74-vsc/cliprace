import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { assertCsrf } from '@/lib/csrf';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { enforceNotReadOnly } from '@/lib/admin/middleware-readonly';
import { createError, formatErrorResponse } from '@/lib/errors';

const RecipientSchema = z
  .object({
    email: z.string().email().optional(),
    user_id: z.string().uuid().optional(),
  })
  .refine((value) => Boolean(value.email || value.user_id), {
    message: 'Recipient must include email or user_id',
  });

const DispatchSchema = z.object({
  template_id: z.string().uuid().optional(),
  subject: z.string().min(2).max(200).optional(),
  body_html: z.string().optional(),
  body_text: z.string().optional(),
  recipients: z.array(RecipientSchema).optional(),
  segment: z
    .object({
      role: z.enum(['all', 'admin', 'brand', 'creator']).default('all'),
      limit: z.number().min(1).max(500).default(100),
    })
    .optional(),
  metadata: z.record(z.any()).optional(),
  schedule_at: z.string().datetime().optional(),
});

function chunk<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAdminPermission('emails.write');
    await enforceNotReadOnly(req, user.id);
    await enforceAdminRateLimit(req, { route: 'admin:email-outbox:dispatch', max: 5, windowMs: 60_000 }, user.id);
    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch (csrfError) {
      throw createError('FORBIDDEN', 'Invalid CSRF token', 403, csrfError);
    }

    const body = await req.json();
    const parsed = DispatchSchema.safeParse(body);
    if (!parsed.success) {
      throw createError('VALIDATION_ERROR', 'Invalid payload', 400, parsed.error.flatten());
    }

    const payload = parsed.data;
    if (!payload.template_id && !payload.subject) {
      throw createError('VALIDATION_ERROR', 'Missing subject or template', 400);
    }

    const admin = getAdminClient();
    let template:
      | {
          id: string;
          subject: string | null;
          body_html: string | null;
          body_text: string | null;
        }
      | null = null;

    if (payload.template_id) {
      const { data: templateRow, error: templateError } = await admin
        .from('notification_templates')
        .select('id, subject, body_html, body_text, channel, is_active')
        .eq('id', payload.template_id)
        .single();
      if (templateError || !templateRow) {
        throw createError('NOT_FOUND', 'Template not found', 404, templateError?.message);
      }
      if (templateRow.channel !== 'email') {
        throw createError('VALIDATION_ERROR', 'Template is not an email template', 400);
      }
      if (!templateRow.is_active) {
        throw createError('CONFLICT', 'Template is disabled', 409);
      }
      template = templateRow;
    }

    const recipients: Array<{ user_id: string | null; email: string | null }> = [];

    if (payload.segment) {
      const role = payload.segment.role;
      let query = admin.from('profiles').select('id, email').limit(payload.segment.limit);
      if (role !== 'all') {
        query = query.eq('role', role);
      }
      const { data: profiles, error: profilesError } = await query;
      if (profilesError) {
        throw createError('DATABASE_ERROR', 'Failed to load recipients', 500, profilesError.message);
      }
      for (const profile of profiles ?? []) {
        if (!profile.email) continue;
        recipients.push({ user_id: profile.id, email: profile.email });
      }
    } else if (payload.recipients && payload.recipients.length > 0) {
      const userIds = payload.recipients
        .map((recipient) => recipient.user_id)
        .filter(Boolean) as string[];
      let userMap = new Map<string, { id: string; email: string | null }>();
      if (userIds.length > 0) {
        const { data: profiles, error: profilesError } = await admin
          .from('profiles')
          .select('id, email')
          .in('id', Array.from(new Set(userIds)));
        if (profilesError) {
          throw createError('DATABASE_ERROR', 'Failed to load users', 500, profilesError.message);
        }
        userMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
      }

      for (const recipient of payload.recipients) {
        if (recipient.email) {
          recipients.push({ user_id: recipient.user_id ?? null, email: recipient.email });
          continue;
        }
        if (recipient.user_id) {
          const profile = userMap.get(recipient.user_id);
          if (profile?.email) {
            recipients.push({ user_id: recipient.user_id, email: profile.email });
          }
        }
      }
    }

    if (recipients.length === 0) {
      throw createError('VALIDATION_ERROR', 'No recipients found', 400);
    }

    const subject = payload.subject ?? template?.subject ?? null;
    const bodyHtml = payload.body_html ?? template?.body_html ?? null;
    const bodyText = payload.body_text ?? template?.body_text ?? null;

    if (!subject || (!bodyHtml && !bodyText)) {
      throw createError('VALIDATION_ERROR', 'Missing subject or body', 400);
    }

    const now = new Date().toISOString();
    const scheduleAt = payload.schedule_at ?? null;
    const rows = recipients.map((recipient) => ({
      template_id: payload.template_id ?? null,
      user_id: recipient.user_id,
      to_email: recipient.email,
      subject,
      body_html: bodyHtml,
      body_text: bodyText,
      status: 'queued',
      scheduled_at: scheduleAt,
      metadata: payload.metadata ?? {},
      created_at: now,
      updated_at: now,
    }));

    const batches = chunk(rows, 200);
    for (const batch of batches) {
      const { error: insertError } = await admin.from('email_outbox').insert(batch);
      if (insertError) {
        throw createError('DATABASE_ERROR', 'Failed to enqueue emails', 500, insertError.message);
      }
    }

    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'email_dispatch',
      table_name: 'email_outbox',
      new_values: {
        template_id: payload.template_id ?? null,
        recipients: recipients.length,
        segment: payload.segment ?? null,
      },
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({ ok: true, queued: rows.length });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
