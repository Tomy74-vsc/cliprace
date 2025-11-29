/*
Source: POST /api/uploads/message-attachment/sign
Effect: return bucket+path under contest_assets for a thread with contest_id (policy requires folder by contest)
*/
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rateLimit';
import { assertCsrf } from '@/lib/csrf';
import crypto from 'crypto';

const BodySchema = z.object({ thread_id: z.string().uuid(), filename: z.string().min(1), mime: z.string().min(1), size: z.number().int().positive() });

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 10/min per IP
    const ip = req.headers.get('x-forwarded-for') || (req as any).ip || 'unknown';
    const rlKey = `uploads:message-attachment:sign:${ip}`;
    if (!(await rateLimit({ key: rlKey, route: 'uploads:message-attachment:sign', windowMs: 60 * 1000, max: 10 }))) {
      return NextResponse.json({ ok: false, message: 'Trop de requêtes, réessayez plus tard.' }, { status: 429 });
    }

    // CSRF check
    try { assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf')); } catch { return NextResponse.json({ ok: false, message: 'CSRF invalide' }, { status: 403 }); }
    const supabaseSSR = await getSupabaseSSR();
    const { data: { user } } = await supabaseSSR.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ ok: false, message: 'Invalid body', errors: parsed.error.flatten() }, { status: 400 });
    const { thread_id, filename, mime, size } = parsed.data;

    const admin = getSupabaseAdmin();
    const { data: thread, error: tErr } = await admin
      .from('messages_threads')
      .select('id, contest_id, brand_id, creator_id')
      .eq('id', thread_id)
      .single();
    if (tErr || !thread) return NextResponse.json({ ok: false, message: 'Thread not found' }, { status: 404 });
    if (!thread.contest_id) return NextResponse.json({ ok: false, message: 'Attachments require a contest-bound thread' }, { status: 409 });
    if (user.id !== thread.brand_id && user.id !== thread.creator_id) return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });

    const allowed = ['image/', 'application/pdf'];
    if (!allowed.some((p) => mime.startsWith(p))) return NextResponse.json({ ok: false, message: 'Unsupported MIME' }, { status: 415 });
    if (size > 5 * 1024 * 1024) return NextResponse.json({ ok: false, message: 'File too large' }, { status: 413 });

    const uid = crypto.randomUUID();
    const safeName = filename.replace(/[^A-Za-z0-9._-]/g, '_');
    const path = `${thread.contest_id}/attachments/${thread_id}/${uid}_${safeName}`;
    const bucket = 'contest_assets';
    return NextResponse.json({ ok: true, bucket, path });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Server error';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
