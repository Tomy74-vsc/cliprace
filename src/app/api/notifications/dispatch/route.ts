/*
Source: POST /api/notifications/dispatch
Effects: insert notifications (optionally template-resolved later)
*/
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rateLimit';
import { assertCsrf } from '@/lib/csrf';

const BodySchema = z.object({ user_id: z.string().uuid(), type: z.string().min(1), content: z.any() });

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 30/min per IP
    const ip = req.headers.get('x-forwarded-for') || (req as UnsafeAny).ip || 'unknown';
    const rlKey = `notifications:dispatch:${ip}`;
    if (!(await rateLimit({ key: rlKey, route: 'notifications:dispatch', windowMs: 60 * 1000, max: 30 }))) {
      return NextResponse.json({ ok: false, message: 'Trop de requÃªtes, rÃ©essayez plus tard.' }, { status: 429 });
    }

    // CSRF
    try { assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf')); } catch { return NextResponse.json({ ok: false, message: 'CSRF invalide' }, { status: 403 }); }
    const supabaseSSR = await getSupabaseSSR();
    const { data: { user } } = await supabaseSSR.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ ok: false, message: 'Invalid body', errors: parsed.error.flatten() }, { status: 400 });

    const admin = getSupabaseAdmin();
    const { error } = await admin.from('notifications').insert({
      user_id: parsed.data.user_id,
      type: parsed.data.type,
      content: parsed.data.content,
    });
    if (error) return NextResponse.json({ ok: false, message: 'Insert failed', error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Server error';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

