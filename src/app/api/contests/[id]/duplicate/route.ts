/*
Source: POST /api/contests/[id]/duplicate
Effects: Creates a new draft contest by copying all fields, terms, assets, and prizes from an existing contest.
Rules:
- Brand owner or admin only
- Rate limited: 5 duplications / 5 min
- CSRF protected
- Returns the new contest ID for redirect to edit
*/
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getUserRole } from '@/lib/auth';
import { rateLimit } from '@/lib/rateLimit';
import { assertCsrf } from '@/lib/csrf';
import { createError, type AppError } from '@/lib/errors';
import { getClientIp, buildRateLimitKey } from '@/lib/safe-ip';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sourceContestId } = await params;
    const supabaseSSR = await getSupabaseSSR();
    const {
      data: { user },
    } = await supabaseSSR.auth.getUser();
    if (!user) {
      throw createError('UNAUTHORIZED', 'Authentification requise', 401);
    }

    const role = await getUserRole(user.id);
    if (role !== 'brand' && role !== 'admin') {
      throw createError('FORBIDDEN', 'Seules les marques ou admins peuvent dupliquer un concours', 403);
    }

    // Rate limit: 5 duplications / 5 min per user+ip+ua
    const rlKey = buildRateLimitKey('contests:duplicate', user.id, req);
    if (
      !(await rateLimit({
        key: rlKey,
        route: 'contests:duplicate',
        windowMs: 5 * 60 * 1000,
        max: 5,
      }))
    ) {
      throw createError('RATE_LIMIT', 'Trop de duplications, r\u00e9essayez plus tard', 429);
    }

    // CSRF check
    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch {
      throw createError('FORBIDDEN', 'Jeton CSRF invalide ou manquant', 403);
    }

    const admin = getSupabaseAdmin();

    // Fetch source contest with all related data
    const { data: source, error: srcErr } = await admin
      .from('contests')
      .select(
        `
        id, title, brief_md, cover_url, prize_pool_cents, currency,
        networks, max_winners, brand_id, contest_type, product_details,
        shipping_info, platform_fee, budget_cents,
        contest_terms:contest_terms_id (
          version, terms_markdown, terms_url
        ),
        contest_assets ( url, type ),
        contest_prizes ( position, amount_cents, percentage )
      `
      )
      .eq('id', sourceContestId)
      .single();

    if (srcErr || !source) {
      throw createError('NOT_FOUND', 'Concours source introuvable', 404);
    }

    // Ownership check
    const isOwner = source.brand_id === user.id;
    const isAdmin = role === 'admin';
    if (!isOwner && !isAdmin) {
      throw createError('FORBIDDEN', 'Tu n\'as pas les droits pour dupliquer ce concours', 403);
    }

    // Prepare data for duplication
    const newTitle = `Copie de ${source.title}`.slice(0, 120);
    const slugBase = slugify(newTitle);
    const slug = await ensureUniqueSlug(admin, slugBase);

    // Set dates 7 days from now
    const startAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const endAt = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString();

    // Normalize terms
    const terms = Array.isArray(source.contest_terms)
      ? (source.contest_terms as Array<{
          version: string | null;
          terms_markdown: string | null;
          terms_url: string | null;
        }>)[0] ?? null
      : (source.contest_terms as {
          version: string | null;
          terms_markdown: string | null;
          terms_url: string | null;
        } | null);

    // Normalize assets for RPC
    const assets = ((source.contest_assets || []) as Array<{ url: string; type: string }>).map(
      (a) => ({ url: a.url, type: a.type })
    );

    // Normalize prizes for RPC
    const prizes = ((source.contest_prizes || []) as Array<{
      position: number;
      amount_cents: number | null;
      percentage: number | null;
    }>).map((p) => ({
      position: p.position,
      amount_cents: p.amount_cents,
      percentage: p.percentage,
    }));

    // Call the RPC to create the new contest atomically
    const rpcParams: Record<string, unknown> = {
      p_brand_id: isAdmin && !isOwner ? source.brand_id : user.id,
      p_title: newTitle,
      p_slug: slug,
      p_brief_md: source.brief_md || '',
      p_start_at: startAt,
      p_end_at: endAt,
      p_prize_pool_cents: source.prize_pool_cents || 0,
      p_cover_url: source.cover_url || null,
      p_currency: source.currency || 'EUR',
      p_networks: source.networks || [],
      p_max_winners: source.max_winners || 1,
      p_terms_version: null, // New version will be auto-generated
      p_terms_markdown: terms?.terms_markdown || null,
      p_terms_url: terms?.terms_url || null,
      p_assets: assets.length > 0 ? assets : [],
      p_prizes: prizes.length > 0 ? prizes : [],
      p_budget_cents: source.budget_cents || source.prize_pool_cents || 0,
      p_contest_type: (source as Record<string, unknown>).contest_type || 'cash',
      p_product_details: (source as Record<string, unknown>).product_details || null,
      p_shipping_info: (source as Record<string, unknown>).shipping_info || null,
      p_platform_fee: (source as Record<string, unknown>).platform_fee || 0,
    };

    const { data: newContestId, error: rpcError } = await admin.rpc(
      'create_contest_complete',
      rpcParams
    );

    if (rpcError || !newContestId) {
      console.error('Duplicate RPC error:', rpcError);
      throw createError(
        'DATABASE_ERROR',
        `Duplication impossible: ${rpcError?.message || 'Erreur inconnue'}`,
        500
      );
    }

    // Audit log
    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'contest_duplicate',
      table_name: 'contests',
      row_pk: newContestId as string,
      new_values: { source_contest_id: sourceContestId },
      ip: getClientIp(req),
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({
      ok: true,
      contest_id: newContestId,
      slug,
    });
  } catch (error) {
    console.error('Error in POST /api/contests/[id]/duplicate:', error);
    if (
      error &&
      typeof error === 'object' &&
      'httpStatus' in error &&
      'code' in error
    ) {
      const e = error as AppError;
      return NextResponse.json(
        { ok: false, code: e.code, message: e.message, details: e.details },
        { status: e.httpStatus }
      );
    }
    return NextResponse.json(
      { ok: false, code: 'UNKNOWN', message: 'Server error' },
      { status: 500 }
    );
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || `contest-${Date.now()}`;
}

async function ensureUniqueSlug(
  admin: ReturnType<typeof getSupabaseAdmin>,
  base: string
) {
  let finalSlug = base || `contest-${Date.now()}`;
  let attempt = 1;
  while (attempt <= 10) {
    const { count, error } = await admin
      .from('contests')
      .select('id', { count: 'exact', head: true })
      .eq('slug', finalSlug);
    if (error) {
      throw createError('DATABASE_ERROR', 'Impossible de v\u00e9rifier le slug', 500);
    }
    if (!count) return finalSlug;
    finalSlug = `${base}-${attempt + 1}`;
    attempt += 1;
  }
  throw createError('DATABASE_ERROR', 'Impossible de g\u00e9n\u00e9rer un slug unique', 500);
}
