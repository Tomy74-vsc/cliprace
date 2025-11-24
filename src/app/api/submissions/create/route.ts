/*
Source: POST /api/submissions/create
Tables: submissions, contest_terms_acceptances, contests, profiles, notifications, audit_logs
DB functions: is_contest_active(uuid), can_creator_submit(uuid, uuid)
Notes:
- MVP liens vidéo uniquement (TikTok/IG Reels/YouTube Shorts)
- Créée avec service_role en back, user = auth.uid() récupéré via SSR
*/
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rateLimit';
import { assertCsrf } from '@/lib/csrf';

const BodySchema = z.object({
  contest_id: z.string().uuid(),
  platform: z.enum(['tiktok', 'instagram', 'youtube']),
  video_url: z.string().url(),
  caption: z.string().max(2200).optional(),
});

function validPlatformUrl(platform: 'tiktok'|'instagram'|'youtube', url: string) {
  const patterns: Record<string, RegExp> = {
    tiktok: /^https?:\/\/(www\.)?tiktok\.com\/@[A-Za-z0-9._-]+\/video\/\d+(?:\?.*)?$/i,
    instagram: /^https?:\/\/(www\.)?instagram\.com\/reel\/[-A-Za-z0-9_]+\/?(?:\?.*)?$/i,
    youtube: /^https?:\/\/(www\.)?youtube\.com\/shorts\/[-A-Za-z0-9_]+\/?(?:\?.*)?$/i,
  };
  return patterns[platform].test(url);
}

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 1/min per user
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    const supabaseSSR = getSupabaseSSR();
    const {
      data: { user },
    } = await supabaseSSR.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

    const rlKey = `submissions:create:${user.id}:${ip}`;
    if (!(await rateLimit({ key: rlKey, route: 'submissions:create', windowMs: 60_000, max: 1 }))) {
      return NextResponse.json({ ok: false, message: 'Rate limit exceeded' }, { status: 429 });
    }

    // CSRF check (double-submit): require x-csrf header matching cookie
    try {
      assertCsrf(req.headers.get('x-csrf') || undefined);
    } catch {
      return NextResponse.json({ ok: false, message: 'Invalid CSRF token' }, { status: 403 });
    }

    const json = await req.json();
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, message: 'Invalid body', errors: parsed.error.flatten() }, { status: 400 });
    }
    const { contest_id, platform, video_url, caption } = parsed.data;

    if (!validPlatformUrl(platform, video_url)) {
      return NextResponse.json({ ok: false, message: 'Invalid video URL for platform' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Check contest active
    const { data: activeRes, error: activeErr } = await admin.rpc('is_contest_active', { p_contest_id: contest_id });
    if (activeErr) return NextResponse.json({ ok: false, message: 'Check active failed', error: activeErr.message }, { status: 500 });
    if (!activeRes) return NextResponse.json({ ok: false, message: 'Contest not active' }, { status: 409 });

    // Eligibility limit (max_submissions_per_creator)
    const { data: canRes, error: canErr } = await admin.rpc('can_creator_submit', { p_contest_id: contest_id, p_creator_id: user.id });
    if (canErr) return NextResponse.json({ ok: false, message: 'Eligibility check failed', error: canErr.message }, { status: 500 });
    if (!canRes) return NextResponse.json({ ok: false, message: 'Not eligible to submit (limit reached or rejected)' }, { status: 409 });

    // Ensure terms acceptance if contest has specific terms
    const { data: contestRow, error: contestErr } = await admin
      .from('contests')
      .select('contest_terms_id, brand_id')
      .eq('id', contest_id)
      .single();
    if (contestErr || !contestRow) return NextResponse.json({ ok: false, message: 'Contest not found' }, { status: 404 });

    if (contestRow.contest_terms_id) {
      const { data: acceptance } = await admin
        .from('contest_terms_acceptances')
        .select('id')
        .eq('contest_id', contest_id)
        .eq('user_id', user.id)
        .eq('contest_terms_id', contestRow.contest_terms_id)
        .maybeSingle();
      if (!acceptance) {
        const ip = req.headers.get('x-forwarded-for') ?? req.ip ?? undefined;
        const ua = req.headers.get('user-agent') ?? undefined;
        await admin.from('contest_terms_acceptances').insert({
          contest_id,
          user_id: user.id,
          contest_terms_id: contestRow.contest_terms_id,
          ip_address: ip,
          user_agent: ua,
        });
      }
    }

    // Insert submission (status defaults to 'pending'); store caption into title if provided
    const insertPayload: {
      contest_id: string;
      creator_id: string;
      platform: 'tiktok' | 'instagram' | 'youtube';
      external_url: string;
      title?: string;
    } = {
      contest_id,
      creator_id: user.id,
      platform,
      external_url: video_url,
    };
    if (caption) insertPayload.title = caption;

    const { data: sub, error: subErr } = await admin
      .from('submissions')
      .insert(insertPayload)
      .select('id, status')
      .single();
    if (subErr) {
      const isDup = subErr.message?.toLowerCase().includes('duplicate') || subErr.code === '23505';
      const status = isDup ? 409 : 500;
      return NextResponse.json({ ok: false, message: 'Insert failed', error: subErr.message }, { status });
    }

    // Notify brand
    await admin.from('notifications').insert({
      user_id: contestRow.brand_id,
      type: 'submission_created',
      content: { contest_id, submission_id: sub.id, creator_id: user.id },
    });

    // Audit log
    const ip2 = req.headers.get('x-forwarded-for') ?? undefined;
    const ua = req.headers.get('user-agent') ?? undefined;
    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'submission_create',
      table_name: 'submissions',
      row_pk: sub.id,
      new_values: insertPayload,
      ip: ip2,
      user_agent: ua,
    });

    return NextResponse.json({ ok: true, submission_id: sub.id, status: sub.status });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Server error';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
