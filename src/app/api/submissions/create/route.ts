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
import { getClientIp, buildRateLimitKey } from '@/lib/safe-ip';

const BodySchema = z.object({
  contest_id: z.string().uuid(),
  platform: z.enum(['tiktok', 'instagram', 'youtube']),
  video_url: z.string().url(),
  caption: z.string().max(2200).optional(),
});

function validPlatformUrl(platform: 'tiktok' | 'instagram' | 'youtube', url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const patterns: Record<string, RegExp> = {
      tiktok: /(.*\.)?tiktok\.com$/,
      instagram: /(.*\.)?instagram\.com$/,
      youtube: /(.*\.)?(youtube\.com|youtu\.be)$/,
    };
    if (!patterns[platform].test(host)) return false;
    // path checks all still light, but ensures right domain
    if (platform === 'tiktok' && !/\/video\/\d+/.test(parsed.pathname)) return false;
    if (platform === 'instagram' && !/\/reel\/[A-Za-z0-9_-]+/.test(parsed.pathname)) return false;
    if (platform === 'youtube' && !(/\/shorts\/[A-Za-z0-9_-]+/.test(parsed.pathname) || /^\/[-A-Za-z0-9_]{8,}$/.test(parsed.pathname))) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 1/min per user+ip+ua
    const supabaseSSR = await getSupabaseSSR();
    const {
      data: { user },
    } = await supabaseSSR.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, message: 'Non autorisé' }, { status: 401 });

    const rlKey = buildRateLimitKey('submissions:create', user.id, req);
    if (!(await rateLimit({ key: rlKey, route: 'submissions:create', windowMs: 60_000, max: 1 }))) {
      return NextResponse.json({ ok: false, message: 'Trop de tentatives, réessaie dans une minute.' }, { status: 429 });
    }

    // CSRF check (double-submit): require x-csrf header matching cookie
    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf') || undefined);
    } catch {
      return NextResponse.json({ ok: false, message: 'Token CSRF invalide' }, { status: 403 });
    }

    const json = await req.json();
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, message: 'Requête invalide', errors: parsed.error.flatten() }, { status: 400 });
    }
    const { contest_id, platform, video_url, caption } = parsed.data;

    if (!validPlatformUrl(platform, video_url)) {
      return NextResponse.json({ ok: false, message: 'Lien invalide pour cette plateforme.' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Check contest active
    const { data: activeRes, error: activeErr } = await admin.rpc('is_contest_active', { p_contest_id: contest_id });
    if (activeErr) {
      return NextResponse.json({ ok: false, message: 'Impossible de vérifier le concours', error: activeErr.message }, { status: 500 });
    }
    if (!activeRes) {
      return NextResponse.json({ ok: false, message: 'Ce concours n’est pas actif.' }, { status: 409 });
    }

    // Eligibility limit (max_submissions_per_creator)
    const { data: canSubmitRes, error: canSubmitErr } = await admin.rpc('can_submit_to_contest', {
      p_contest_id: contest_id,
      p_user_id: user.id,
    });

    let isEligible: boolean | null = null;
    let eligibilityError: Error | null = null;

    if (!canSubmitErr) {
      isEligible = !!canSubmitRes;
    } else if (canSubmitErr.message?.includes('can_submit_to_contest')) {
      const { data: legacyRes, error: legacyErr } = await admin.rpc('can_creator_submit', {
        p_contest_id: contest_id,
        p_creator_id: user.id,
      });
      if (legacyErr) {
        eligibilityError = legacyErr;
      } else {
        isEligible = !!legacyRes;
      }
    } else {
      eligibilityError = canSubmitErr;
    }

    if (eligibilityError) {
      return NextResponse.json(
        { ok: false, message: 'Impossible de vérifier ton éligibilité.', error: eligibilityError.message },
        { status: 500 }
      );
    }
    if (!isEligible) {
      return NextResponse.json({ ok: false, message: 'Tu ne peux plus participer à ce concours.' }, { status: 409 });
    }

    // Ensure terms acceptance + metadata
    const { data: contestRow, error: contestErr } = await admin
      .from('contests')
      .select('contest_terms_id, brand_id, networks')
      .eq('id', contest_id)
      .single();
    if (contestErr || !contestRow) {
      return NextResponse.json({ ok: false, message: 'Concours introuvable.' }, { status: 404 });
    }

    if (contestRow.contest_terms_id) {
      const { data: acceptance } = await admin
        .from('contest_terms_acceptances')
        .select('id')
        .eq('contest_id', contest_id)
        .eq('user_id', user.id)
        .eq('contest_terms_id', contestRow.contest_terms_id)
        .maybeSingle();
      if (!acceptance) {
        const acceptIp = getClientIp(req);
        const ua = req.headers.get('user-agent') ?? undefined;
        await admin.from('contest_terms_acceptances').insert({
          contest_id,
          user_id: user.id,
          contest_terms_id: contestRow.contest_terms_id,
          ip_address: acceptIp,
          user_agent: ua,
        });
      }
    }

    // Prevent duplicate URL for same contest/creator with clearer message
    const { data: existing } = await admin
      .from('submissions')
      .select('id')
      .eq('contest_id', contest_id)
      .eq('creator_id', user.id)
      .eq('external_url', video_url)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ ok: false, message: 'Ce lien a déjà été soumis pour ce concours.' }, { status: 409 });
    }

    // Platform allowed for this contest
    const networks = (contestRow.networks as string[]) || [];
    if (networks.length > 0 && !networks.includes(platform)) {
      return NextResponse.json({ ok: false, message: 'Plateforme non autorisée pour ce concours.' }, { status: 403 });
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
      return NextResponse.json({ ok: false, message: 'Impossible de créer la participation.', error: subErr.message }, { status });
    }

    // Notify brand
    await admin.from('notifications').insert({
      user_id: contestRow.brand_id,
      type: 'submission_created',
      content: { contest_id, submission_id: sub.id, creator_id: user.id },
    });

    // Audit log
    const auditIp = getClientIp(req);
    const ua = req.headers.get('user-agent') ?? undefined;
    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'submission_create',
      table_name: 'submissions',
      row_pk: sub.id,
      new_values: insertPayload,
      ip: auditIp,
      user_agent: ua,
    });

    return NextResponse.json({ ok: true, submission_id: sub.id, status: sub.status });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erreur interne';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
