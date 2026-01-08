/*
Source: GET/POST /api/messages/threads
Tables: messages_threads, audit_logs
Rules:
- GET: list threads where current user is brand_id or creator_id
- POST: create thread for a contest; requires contest_id and participant_id; unique on (contest_id, brand_id, creator_id)
*/
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getUserRole } from '@/lib/auth';
import { rateLimit } from '@/lib/rateLimit';
import { assertCsrf } from '@/lib/csrf';

export async function GET() {
  const supabaseSSR = await getSupabaseSSR();
  const { data: { user } } = await supabaseSSR.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('messages_threads')
    .select('id, contest_id, brand_id, creator_id, last_message, unread_for_brand, unread_for_creator, updated_at')
    .or(`brand_id.eq.${user.id},creator_id.eq.${user.id}`)
    .order('updated_at', { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ ok: false, message: 'Load threads failed', error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, threads: data });
}

const CreateSchema = z.object({
  participant_id: z.string().uuid(),
  contest_id: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 10 requests/min per user
    const ip = req.headers.get('x-forwarded-for') || (req as UnsafeAny).ip || 'unknown';
    const rlKey = `messages:threads:create:${ip}`;
    if (!(await rateLimit({ key: rlKey, route: 'messages:threads:create', windowMs: 60 * 1000, max: 10 }))) {
      return NextResponse.json({ ok: false, message: 'Trop de requÃªtes, rÃ©essayez plus tard.' }, { status: 429 });
    }

    // CSRF check (double submit)
    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch {
      return NextResponse.json({ ok: false, message: 'CSRF invalide' }, { status: 403 });
    }
    const supabaseSSR = await getSupabaseSSR();
    const { data: { user } } = await supabaseSSR.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    const role = await getUserRole(user.id);
    if (!role || role === 'admin') return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, message: 'Invalid body', errors: parsed.error.flatten() }, { status: 400 });
    }
    const { participant_id, contest_id } = parsed.data;

    const admin = getSupabaseAdmin();
    const brand_id = role === 'brand' ? user.id : participant_id;
    const creator_id = role === 'creator' ? user.id : participant_id;

    // Check contest exists
    const { data: contest, error: cErr } = await admin
      .from('contests')
      .select('id')
      .eq('id', contest_id)
      .single();
    if (cErr || !contest) return NextResponse.json({ ok: false, message: 'Contest not found' }, { status: 404 });

    // Upsert-like: try insert; if conflict on unique (contest_id,brand_id,creator_id) return existing
    const { data: inserted, error: insErr } = await admin
      .from('messages_threads')
      .insert({ contest_id, brand_id, creator_id })
      .select('id')
      .single();
    if (insErr && !insErr.message.toLowerCase().includes('duplicate')) {
      return NextResponse.json({ ok: false, message: 'Create failed', error: insErr.message }, { status: 500 });
    }

    // If duplicate, select existing
    let threadId = inserted?.id as string | undefined;
    if (!threadId) {
      const { data: existing, error: exErr } = await admin
        .from('messages_threads')
        .select('id')
        .eq('contest_id', contest_id)
        .eq('brand_id', brand_id)
        .eq('creator_id', creator_id)
        .single();
      if (exErr || !existing) return NextResponse.json({ ok: false, message: 'Lookup failed' }, { status: 500 });
      threadId = existing.id;
    }

    // Audit
    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'thread_create',
      table_name: 'messages_threads',
      row_pk: threadId,
      new_values: { contest_id, brand_id, creator_id },
    });

    return NextResponse.json({ ok: true, thread_id: threadId });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Server error';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

