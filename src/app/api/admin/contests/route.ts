import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { assertCsrf } from '@/lib/csrf';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { enforceNotReadOnly } from '@/lib/admin/middleware-readonly';
import { contestCreateSchema } from '@/lib/validators/contests';
import { createError, formatErrorResponse } from '@/lib/errors';

const QuerySchema = z.object({
  status: z.string().optional(),
  q: z.string().optional(),
  brand_id: z.string().uuid().optional(),
  org_id: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  page: z.coerce.number().min(1).default(1),
});

export async function GET(req: NextRequest) {
  try {
    await requireAdminPermission('contests.read');
    const parsed = QuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
    const query = parsed.success ? parsed.data : QuerySchema.parse({});
    const limit = query.limit;
    const from = (query.page - 1) * limit;
    const to = from + limit - 1;

    const admin = getAdminClient();
    let contestsQuery = admin
      .from('contests')
      .select(
        'id, title, slug, status, start_at, end_at, prize_pool_cents, budget_cents, created_at, brand_id, org_id, brand:profiles(id, display_name, email), org:orgs(id, name)',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    if (query.status) {
      contestsQuery = contestsQuery.eq('status', query.status);
    }
    if (query.brand_id) {
      contestsQuery = contestsQuery.eq('brand_id', query.brand_id);
    }
    if (query.org_id) {
      contestsQuery = contestsQuery.eq('org_id', query.org_id);
    }
    if (query.q) {
      const q = `%${query.q}%`;
      contestsQuery = contestsQuery.or(`title.ilike.${q},slug.ilike.${q}`);
    }

    const { data: contests, error, count } = await contestsQuery;
    if (error) {
      throw createError('DATABASE_ERROR', 'Failed to load contests', 500, error.message);
    }

    const contestIds = (contests ?? []).map((contest) => contest.id);
    let statsMap = new Map<string, { total_submissions: number; total_views: number }>();
    if (contestIds.length > 0) {
      const { data: statsRows, error: statsError } = await admin
        .from('contest_stats')
        .select('contest_id, total_submissions, total_views')
        .in('contest_id', contestIds);
      if (statsError) {
        throw createError('DATABASE_ERROR', 'Failed to load contest stats', 500, statsError.message);
      }
      statsMap = new Map(
        (statsRows ?? []).map((row) => [
          row.contest_id,
          {
            total_submissions: row.total_submissions ?? 0,
            total_views: row.total_views ?? 0,
          },
        ])
      );
    }

    const items = (contests ?? []).map((contest) => ({
      ...contest,
      stats: statsMap.get(contest.id) ?? { total_submissions: 0, total_views: 0 },
    }));

    return NextResponse.json({
      items,
      pagination: {
        total: count ?? 0,
        page: query.page,
        limit,
      },
    });
  } catch (error) {
    return formatErrorResponse(error);
  }
}

type AllowedPlatform = 'tiktok' | 'instagram' | 'youtube';
type NormalizedPrize = {
  position: number;
  amount_cents: number | null;
  percentage: number | null;
};

const PLATFORM_KEYS: AllowedPlatform[] = ['tiktok', 'instagram', 'youtube'];

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAdminPermission('contests.write');
    await enforceNotReadOnly(req, user.id);
    await enforceAdminRateLimit(req, { route: 'admin:contests:create', max: 30, windowMs: 60_000 }, user.id);
    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch (csrfError) {
      throw createError('FORBIDDEN', 'Invalid CSRF token', 403, csrfError);
    }

    const body = await req.json();
    const parsed = contestCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw createError('VALIDATION_ERROR', 'Invalid payload', 400, parsed.error.flatten());
    }

    const payload = parsed.data;
    if (!payload.brand_id) {
      throw createError('VALIDATION_ERROR', 'brand_id is required', 400);
    }

    const admin = getAdminClient();

    const { data: brand, error: brandError } = await admin
      .from('profiles')
      .select('id, role')
      .eq('id', payload.brand_id)
      .single();
    if (brandError || !brand) {
      throw createError('NOT_FOUND', 'Brand not found', 404, brandError?.message);
    }
    if (brand.role !== 'brand') {
      throw createError('FORBIDDEN', 'Target profile is not a brand', 403);
    }

    const normalizedAssets = normalizeAssets(payload.assets);
    const normalizedPrizes = normalizePrizes(payload.prizes);
    const maxWinners = normalizedPrizes.length
      ? Math.max(...normalizedPrizes.map((prize) => prize.position))
      : 1;

    const allowedPlatforms = extractPlatforms(payload.allowed_platforms);
    const slugBase = slugify(payload.title);
    const slug = await ensureUniqueSlug(admin, slugBase);
    const currency = (payload.currency || 'EUR').toUpperCase();

    const rpcParams: Record<string, unknown> = {
      p_brand_id: payload.brand_id,
      p_title: payload.title,
      p_slug: slug,
      p_brief_md: payload.brief_md || '',
      p_cover_url: payload.cover_url || null,
      p_start_at: payload.start_at,
      p_end_at: payload.end_at,
      p_prize_pool_cents: payload.total_prize_pool_cents || 0,
      p_currency: currency,
      p_networks: allowedPlatforms.length > 0 ? allowedPlatforms : [],
      p_max_winners: maxWinners,
      p_terms_version: payload.terms_version || null,
      p_terms_markdown: payload.terms_markdown || null,
      p_terms_url: payload.terms_url || null,
      p_assets: normalizedAssets.length > 0 ? normalizedAssets : [],
      p_prizes: normalizedPrizes.length > 0 ? normalizedPrizes : [],
      p_budget_cents: payload.total_prize_pool_cents || 0,
    };

    const { data: contestId, error: rpcError } = await admin.rpc('create_contest_complete', rpcParams);
    if (rpcError) {
      throw createError('DATABASE_ERROR', 'Failed to create contest', 500, rpcError.message);
    }
    if (!contestId) {
      throw createError('DATABASE_ERROR', 'Contest creation returned no id', 500);
    }

    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'admin_contest_create',
      table_name: 'contests',
      row_pk: contestId,
      new_values: {
        title: payload.title,
        start_at: payload.start_at,
        end_at: payload.end_at,
        prize_pool_cents: payload.total_prize_pool_cents,
        allowed_platforms: allowedPlatforms,
        slug,
        brand_id: payload.brand_id,
      },
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({ ok: true, contest_id: contestId, slug });
  } catch (error) {
    return formatErrorResponse(error);
  }
}

function extractPlatforms(allowed?: { tiktok?: boolean; instagram?: boolean; youtube?: boolean }): AllowedPlatform[] {
  if (!allowed) return [];
  return PLATFORM_KEYS.filter((key) => allowed[key]);
}

function normalizeAssets(assets?: Array<{ url: string; type?: string }>) {
  if (!assets?.length) {
    return [];
  }

  return assets.map((asset) => ({
    url: asset.url,
    type: (asset.type ?? 'image') as 'image' | 'video' | 'pdf',
  }));
}

function normalizePrizes(
  prizes?: Array<{ rank_from: number; rank_to?: number; amount_cents?: number; percentage?: number }>
): NormalizedPrize[] {
  if (!prizes?.length) return [];

  const normalized: NormalizedPrize[] = [];
  const seen = new Set<number>();

  for (const prize of prizes) {
    const rankTo = prize.rank_to ?? prize.rank_from;
    for (let position = prize.rank_from; position <= rankTo; position += 1) {
      if (seen.has(position)) {
        throw createError(
          'VALIDATION_ERROR',
          `Position ${position} is already defined in prizes`,
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
  return (
    value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || `contest-${Date.now()}`
  );
}

async function ensureUniqueSlug(admin: ReturnType<typeof getAdminClient>, base: string) {
  let finalSlug = base || `contest-${Date.now()}`;
  let attempt = 1;
  while (attempt <= 10) {
    const { count, error } = await admin
      .from('contests')
      .select('id', { count: 'exact', head: true })
      .eq('slug', finalSlug);
    if (error) {
      throw createError('DATABASE_ERROR', 'Unable to validate slug', 500, error.message);
    }
    if (!count) {
      return finalSlug;
    }
    finalSlug = `${base}-${attempt + 1}`;
    attempt += 1;
  }
  throw createError('DATABASE_ERROR', 'Unable to generate a unique slug', 500);
}
