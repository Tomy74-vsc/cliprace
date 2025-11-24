/*
Source: POST /api/contests/create
Effects: create contest draft atomiquement (contests + terms + assets + prizes)
*/
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getUserRole } from '@/lib/auth';
import { rateLimit } from '@/lib/rateLimit';
import { assertCsrf } from '@/lib/csrf';
import { contestCreateSchema, type ContestCreateInput } from '@/lib/validators/contests';
import { createError, formatErrorResponse } from '@/lib/errors';

type AllowedPlatform = 'tiktok' | 'instagram' | 'youtube';
type NormalizedPrize = {
  position: number;
  amount_cents: number | null;
  percentage: number | null;
};

const PLATFORM_KEYS: AllowedPlatform[] = ['tiktok', 'instagram', 'youtube'];

export async function POST(req: NextRequest) {
  try {
    const supabaseSSR = getSupabaseSSR();
    const {
      data: { user },
    } = await supabaseSSR.auth.getUser();
    if (!user) {
      throw createError('UNAUTHORIZED', 'Authentification requise', 401);
    }

    const role = await getUserRole(user.id);
    if (role !== 'brand' && role !== 'admin') {
      throw createError('FORBIDDEN', 'Seules les marques ou admins peuvent crǸer un concours', 403);
    }

    // Rate limit: 2 creations / 5 min par utilisateur
    const ip = req.headers.get('x-forwarded-for') || (req as any).ip || 'unknown';
    const rlKey = `contests:create:${user.id}:${ip}`;
    if (!(await rateLimit({ key: rlKey, route: 'contests:create', windowMs: 5 * 60 * 1000, max: 2 }))) {
      throw createError('RATE_LIMIT', 'Trop de tentatives de crǸation, rǸessayez plus tard', 429);
    }

    try {
      assertCsrf(req.headers.get('x-csrf'));
    } catch {
      throw createError('FORBIDDEN', 'Jeton CSRF invalide ou manquant', 403);
    }

    const body = await req.json();
    const parsed = contestCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw createError('VALIDATION_ERROR', 'Payload invalide', 400, parsed.error.flatten());
    }
    const payload = parsed.data;

    const admin = getSupabaseAdmin();

    const brandId = await resolveBrandId({
      requesterRole: role,
      requesterId: user.id,
      requestedBrandId: payload.brand_id,
      admin,
    });

    const normalizedAssets = normalizeAssets(payload.assets);
    const normalizedPrizes = normalizePrizes(payload.prizes);
    const maxWinners = normalizedPrizes.length
      ? Math.max(...normalizedPrizes.map((prize) => prize.position))
      : 1;

    const allowedPlatforms = extractPlatforms(payload.allowed_platforms);
    const slugBase = slugify(payload.title);
    const slug = await ensureUniqueSlug(admin, slugBase);
    const currency = (payload.currency || 'EUR').toUpperCase();

    const { data: contestId, error: rpcError } = await admin.rpc('create_contest_complete', {
      p_brand_id: brandId,
      p_title: payload.title,
      p_slug: slug,
      p_brief_md: payload.brief_md,
      p_cover_url: payload.cover_url ?? null,
      p_start_at: payload.start_at,
      p_end_at: payload.end_at,
      p_prize_pool_cents: payload.total_prize_pool_cents,
      p_currency: currency,
      p_networks: allowedPlatforms,
      p_max_winners: maxWinners,
      p_terms_version: payload.terms_version ?? null,
      p_terms_markdown: payload.terms_markdown ?? null,
      p_terms_url: payload.terms_url ?? null,
      p_assets: normalizedAssets,
      p_prizes: normalizedPrizes,
      p_budget_cents: payload.total_prize_pool_cents,
    });

    if (rpcError || !contestId) {
      throw createError('DATABASE_ERROR', 'CrǸation concours impossible', 500, rpcError?.message);
    }

    const auditPayload = {
      title: payload.title,
      start_at: payload.start_at,
      end_at: payload.end_at,
      prize_pool_cents: payload.total_prize_pool_cents,
      allowed_platforms: allowedPlatforms,
      slug,
    };

    const ipHeader = req.headers.get('x-forwarded-for') ?? undefined;
    const ua = req.headers.get('user-agent') ?? undefined;
    const { error: auditError } = await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'contest_create',
      table_name: 'contests',
      row_pk: contestId,
      new_values: auditPayload,
      ip: ipHeader,
      user_agent: ua,
    });
    if (auditError) {
      // Ne bloque pas la r��ponse, mais journalise pour investigation
      console.error('Audit log failed for contest_create', auditError);
    }

    return NextResponse.json({ ok: true, contest_id: contestId, slug });
  } catch (error) {
    return formatErrorResponse(error);
  }
}

function extractPlatforms(
  allowed?: ContestCreateInput['allowed_platforms']
): AllowedPlatform[] {
  if (!allowed) return [];
  return PLATFORM_KEYS.filter((key) => allowed[key]);
}

function normalizeAssets(assets?: ContestCreateInput['assets']) {
  if (!assets?.length) {
    return [];
  }

  return assets.map((asset) => ({
    url: asset.url,
    type: asset.type ?? 'image',
  }));
}

function normalizePrizes(prizes?: ContestCreateInput['prizes']): NormalizedPrize[] {
  if (!prizes?.length) return [];

  const normalized: NormalizedPrize[] = [];
  const seen = new Set<number>();

  for (const prize of prizes) {
    const rankTo = prize.rank_to ?? prize.rank_from;
    for (let position = prize.rank_from; position <= rankTo; position += 1) {
      if (seen.has(position)) {
        throw createError(
          'VALIDATION_ERROR',
          `La position ${position} est dǸj�� dǸfinie dans les rǸcompenses`,
          400
        );
      }
      seen.add(position);
      normalized.push({
        position,
        amount_cents: prize.amount_cents ?? null,
        percentage: prize.percentage ?? null,
      });
    }
  }

  return normalized;
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

async function ensureUniqueSlug(admin: ReturnType<typeof getSupabaseAdmin>, base: string) {
  let finalSlug = base || `contest-${Date.now()}`;
  let attempt = 1;
  while (attempt <= 10) {
    const { count, error } = await admin
      .from('contests')
      .select('id', { count: 'exact', head: true })
      .eq('slug', finalSlug);
    if (error) {
      throw createError('DATABASE_ERROR', 'Impossible de vǸrifier le slug', 500, error.message);
    }
    if (!count) {
      return finalSlug;
    }
    finalSlug = `${base}-${attempt + 1}`;
    attempt += 1;
  }
  throw createError('DATABASE_ERROR', 'Impossible de gǸnǸrer un slug unique', 500);
}

async function resolveBrandId({
  requesterRole,
  requesterId,
  requestedBrandId,
  admin,
}: {
  requesterRole: Awaited<ReturnType<typeof getUserRole>>;
  requesterId: string;
  requestedBrandId?: string;
  admin: ReturnType<typeof getSupabaseAdmin>;
}) {
  if (requesterRole === 'admin' && requestedBrandId) {
    const { data, error } = await admin
      .from('profiles')
      .select('id, role')
      .eq('id', requestedBrandId)
      .single();
    if (error || !data) {
      throw createError('NOT_FOUND', 'Marque cible introuvable', 404, error?.message);
    }
    if (data.role !== 'brand') {
      throw createError('FORBIDDEN', 'Le profil cibl�� n\'est pas une marque', 403);
    }
    return data.id;
  }

  if (requestedBrandId && requestedBrandId !== requesterId) {
    throw createError('FORBIDDEN', 'Impossible de crǸer un concours pour une autre marque', 403);
  }

  return requesterId;
}
