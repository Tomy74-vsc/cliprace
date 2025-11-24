/*
Source: POST /api/uploads/contest-asset/sign
Effects: return bucket+path to upload under storage RLS (no presigned upload URL). Client will use Supabase Storage with anon.
Tables: contests (ownership), audit_logs
Rules: user must be brand owner (or admin); MIME/size limits; path = `${contest_id}/assets/${uuid}_${filename}`
*/
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { getUserRole } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rateLimit';
import { assertCsrf } from '@/lib/csrf';
import crypto from 'crypto';

const BodySchema = z.object({ contest_id: z.string().uuid(), filename: z.string().min(1), mime: z.string().min(1), size: z.number().int().positive() });

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 10/min per IP
    const ip = req.headers.get('x-forwarded-for') || (req as any).ip || 'unknown';
    const rlKey = `uploads:contest-asset:sign:${ip}`;
    if (!(await rateLimit({ key: rlKey, route: 'uploads:contest-asset:sign', windowMs: 60 * 1000, max: 10 }))) {
      return NextResponse.json({ ok: false, message: 'Trop de requêtes, réessayez plus tard.' }, { status: 429 });
    }

    // CSRF check
    try { assertCsrf(req.headers.get('x-csrf')); } catch { return NextResponse.json({ ok: false, message: 'CSRF invalide' }, { status: 403 }); }
    const supabaseSSR = getSupabaseSSR();
    const { data: { user } } = await supabaseSSR.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    const role = await getUserRole(user.id);
    if (!role) return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ ok: false, message: 'Invalid body', errors: parsed.error.flatten() }, { status: 400 });
    const { contest_id, filename, mime, size } = parsed.data;

    const admin = getSupabaseAdmin();
    const { data: contest, error: cErr } = await admin.from('contests').select('brand_id').eq('id', contest_id).single();
    if (cErr || !contest) return NextResponse.json({ ok: false, message: 'Contest not found' }, { status: 404 });
    const isOwner = role === 'admin' || contest.brand_id === user.id;
    if (!isOwner) return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });

    const allowed = ['image/', 'video/', 'application/pdf'];
    if (!allowed.some((p) => mime.startsWith(p))) return NextResponse.json({ ok: false, message: 'Unsupported MIME' }, { status: 415 });
    if (size > 10 * 1024 * 1024) return NextResponse.json({ ok: false, message: 'File too large' }, { status: 413 });

    const uid = crypto.randomUUID();
    const safeName = filename.replace(/[^A-Za-z0-9._-]/g, '_');
    const path = `${contest_id}/assets/${uid}_${safeName}`;
    const bucket = 'contest_assets';

    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'upload_sign_contest_asset',
      table_name: 'assets',
      row_pk: null,
      new_values: { bucket, path, mime, size },
    });

    return NextResponse.json({ ok: true, bucket, path });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Server error';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
