/*
Source: POST /api/messages/threads/[id]/messages
Tables: messages, messages_threads, audit_logs, notifications
*/
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rateLimit';
import { assertCsrf } from '@/lib/csrf';

const AttachmentSchema = z.object({
  url: z.string().url(),
  mime_type: z.string().max(120),
});

const BodySchema = z.object({
  body: z.string().max(10_000).optional(),
  attachments: z.array(AttachmentSchema).max(3).optional(),
}).refine(
  (value) => (value.body && value.body.trim().length > 0) || (value.attachments && value.attachments.length > 0),
  { message: 'Un message ou une pièce jointe est requis', path: ['body'] }
);

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const threadId = params.id;
  const supabaseSSR = getSupabaseSSR();
  const {
    data: { user },
  } = await supabaseSSR.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
  }
  const admin = getSupabaseAdmin();
  const { data: thread, error: threadError } = await admin
    .from('messages_threads')
    .select('id, brand_id, creator_id')
    .eq('id', threadId)
    .single();
  if (threadError || !thread) {
    return NextResponse.json({ ok: false, message: 'Thread not found' }, { status: 404 });
  }
  if (user.id !== thread.brand_id && user.id !== thread.creator_id) {
    return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
  }

  const { data: messages, error } = await admin
    .from('messages')
    .select(
      `
      id,
      sender_id,
      body,
      created_at,
      attachments:messages_attachments (
        id,
        url,
        mime_type
      )
    `
    )
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) {
    return NextResponse.json({ ok: false, message: 'Load failed', error: error.message }, { status: 500 });
  }

  const unreadField = user.id === thread.brand_id ? 'unread_for_brand' : 'unread_for_creator';
  await admin.from('messages_threads').update({ [unreadField]: false }).eq('id', threadId);

  return NextResponse.json({ ok: true, messages: messages || [] });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Rate limit: 60 messages/min per user
    const ip = req.headers.get('x-forwarded-for') || (req as any).ip || 'unknown';
    const rlKey = `messages:post:${ip}`;
    if (!(await rateLimit({ key: rlKey, route: 'messages:threads:post', windowMs: 60 * 1000, max: 60 }))) {
      return NextResponse.json({ ok: false, message: 'Trop de requêtes, réessayez plus tard.' }, { status: 429 });
    }

    // CSRF check (double submit)
    try {
      assertCsrf(req.headers.get('x-csrf'));
    } catch {
      return NextResponse.json({ ok: false, message: 'CSRF invalide' }, { status: 403 });
    }
    const threadId = params.id;
    const supabaseSSR = getSupabaseSSR();
    const { data: { user } } = await supabaseSSR.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

    const admin = getSupabaseAdmin();
    const { data: thread, error: tErr } = await admin
      .from('messages_threads')
      .select('id, brand_id, creator_id')
      .eq('id', threadId)
      .single();
    if (tErr || !thread) return NextResponse.json({ ok: false, message: 'Thread not found' }, { status: 404 });
    if (user.id !== thread.brand_id && user.id !== thread.creator_id) {
      return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, message: 'Invalid body', errors: parsed.error.flatten() }, { status: 400 });
    }

    const { data: msg, error: mErr } = await admin
      .from('messages')
      .insert({ thread_id: threadId, sender_id: user.id, body: parsed.data.body?.trim() || '' })
      .select('id')
      .single();
    if (mErr) return NextResponse.json({ ok: false, message: 'Insert failed', error: mErr.message }, { status: 500 });

    if (parsed.data.attachments?.length) {
      const attachmentsPayload = parsed.data.attachments.map((attachment) => ({
        message_id: msg.id,
        url: attachment.url,
        mime_type: attachment.mime_type,
      }));
      const { error: attachErr } = await admin.from('messages_attachments').insert(attachmentsPayload);
      if (attachErr) {
        return NextResponse.json({ ok: false, message: 'Attachment insert failed', error: attachErr.message }, { status: 500 });
      }
    }

    const unread_for_brand = user.id !== thread.brand_id;
    const unread_for_creator = user.id !== thread.creator_id;
    await admin
      .from('messages_threads')
      .update({ last_message: parsed.data.body.slice(0, 200), unread_for_brand, unread_for_creator, updated_at: new Date().toISOString() })
      .eq('id', threadId);

    // Notify the other participant
    const targetUser = user.id === thread.brand_id ? thread.creator_id : thread.brand_id;
    await admin.from('notifications').insert({
      user_id: targetUser,
      type: 'message_new',
      content: { thread_id: threadId, message_id: msg.id },
    });

    // Audit
    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'message_create',
      table_name: 'messages',
      row_pk: msg.id,
      new_values: { thread_id: threadId },
    });

    return NextResponse.json({ ok: true, message_id: msg.id });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Server error';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
