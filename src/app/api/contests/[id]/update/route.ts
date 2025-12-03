/*
Source: PATCH /api/contests/[id]/update
Effects: autosave draft steps (update contests/terms/prizes)
Rules: brand owner or admin; only if status='draft'
*/
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getUserRole } from '@/lib/auth';
import { assertCsrf } from '@/lib/csrf';
import { contestUpdateSchema } from '@/lib/validators/contests';
import { createError, type AppError } from '@/lib/errors';

type AllowedPlatform = 'tiktok' | 'instagram' | 'youtube';
type NormalizedPrize = {
  position: number;
  amount_cents: number | null;
  percentage: number | null;
};

const PLATFORM_KEYS: AllowedPlatform[] = ['tiktok', 'instagram', 'youtube'];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: contestId } = await params;
    const supabaseSSR = await getSupabaseSSR();
    const {
      data: { user },
    } = await supabaseSSR.auth.getUser();
    if (!user) {
      throw createError('UNAUTHORIZED', 'Authentification requise', 401);
    }

    const role = await getUserRole(user.id);
    if (role !== 'brand' && role !== 'admin') {
      throw createError('FORBIDDEN', 'Seules les marques ou admins peuvent modifier un concours', 403);
    }

    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch {
      throw createError('FORBIDDEN', 'Jeton CSRF invalide ou manquant', 403);
    }

    const body = await req.json();
    const parsed = contestUpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw createError('VALIDATION_ERROR', 'Payload invalide', 400, parsed.error.flatten());
    }
    const payload = parsed.data;

    const admin = getSupabaseAdmin();

    // Vérifier que le concours existe et appartient à l'utilisateur
    const { data: contest, error: contestError } = await admin
      .from('contests')
      .select('id, brand_id, status')
      .eq('id', contestId)
      .single();

    if (contestError || !contest) {
      throw createError('NOT_FOUND', 'Concours introuvable', 404);
    }

    const isOwner = contest.brand_id === user.id;
    const isAdmin = role === 'admin';
    if (!isOwner && !isAdmin) {
      throw createError('FORBIDDEN', 'Tu n\'as pas les droits pour modifier ce concours', 403);
    }

    // Ne permettre la mise à jour que si le statut est 'draft'
    if (contest.status !== 'draft') {
      throw createError('FORBIDDEN', 'Seuls les brouillons peuvent être modifiés', 403);
    }

    // Préparer les données de mise à jour
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (payload.title !== undefined) {
      updateData.title = payload.title;
    }
    if (payload.brief_md !== undefined) {
      updateData.brief_md = payload.brief_md;
    }
    if (payload.cover_url !== undefined) {
      updateData.cover_url = payload.cover_url || null;
    }
    if (payload.start_at !== undefined) {
      updateData.start_at = payload.start_at;
    }
    if (payload.end_at !== undefined) {
      updateData.end_at = payload.end_at;
    }
    if (payload.total_prize_pool_cents !== undefined) {
      updateData.prize_pool_cents = payload.total_prize_pool_cents;
      updateData.budget_cents = payload.total_prize_pool_cents;
    }
    if (payload.currency !== undefined) {
      updateData.currency = payload.currency.toUpperCase();
    }
    if (payload.allowed_platforms !== undefined) {
      const allowedPlatforms = extractPlatforms(payload.allowed_platforms);
      updateData.networks = allowedPlatforms;
    }

    // Mettre à jour le concours
    const { error: updateError } = await admin
      .from('contests')
      .update(updateData)
      .eq('id', contestId);

    if (updateError) {
      throw createError('DATABASE_ERROR', 'Impossible de mettre à jour le concours', 500, updateError.message);
    }

    // Mettre à jour les CGU si fournies
    if (payload.terms_markdown !== undefined || payload.terms_url !== undefined || payload.terms_version !== undefined) {
      const { data: existingTerms } = await admin
        .from('contests')
        .select('contest_terms_id')
        .eq('id', contestId)
        .single();

      const termsId = existingTerms?.contest_terms_id;

      if (termsId) {
        // Mettre à jour les CGU existantes
        const termsUpdate: Record<string, unknown> = {};
        if (payload.terms_markdown !== undefined) {
          termsUpdate.terms_markdown = payload.terms_markdown || null;
        }
        if (payload.terms_url !== undefined) {
          termsUpdate.terms_url = payload.terms_url || null;
        }
        if (payload.terms_version !== undefined) {
          termsUpdate.version = payload.terms_version || null;
        }

        if (Object.keys(termsUpdate).length > 0) {
          await admin.from('contest_terms').update(termsUpdate).eq('id', termsId);
        }
      } else if (payload.terms_markdown || payload.terms_url) {
        // Créer de nouvelles CGU
        const termsVersion = payload.terms_version || `contest-${contestId}-${Date.now()}`;
        const { data: newTerms, error: termsError } = await admin
          .from('contest_terms')
          .insert({
            version: termsVersion,
            terms_markdown: payload.terms_markdown || null,
            terms_url: payload.terms_url || null,
            is_active: true,
          })
          .select('id')
          .single();

        if (termsError || !newTerms) {
          console.error('Failed to create contest terms', termsError);
        } else {
          // Lier les CGU au concours
          await admin
            .from('contests')
            .update({ contest_terms_id: newTerms.id })
            .eq('id', contestId);
        }
      }
    }

    // Mettre à jour les assets si fournis
    if (payload.assets !== undefined) {
      // Supprimer les anciens assets
      await admin.from('contest_assets').delete().eq('contest_id', contestId);

      // Ajouter les nouveaux assets
      if (payload.assets.length > 0) {
        const normalizedAssets = normalizeAssets(payload.assets);
        if (normalizedAssets.length > 0) {
          await admin.from('contest_assets').insert(
            normalizedAssets.map((asset) => ({
              contest_id: contestId,
              url: asset.url,
              type: asset.type,
            }))
          );
        }
      }
    }

    // Mettre à jour les prix si fournis
    if (payload.prizes !== undefined) {
      // Supprimer les anciens prix
      await admin.from('contest_prizes').delete().eq('contest_id', contestId);

      // Ajouter les nouveaux prix
      if (payload.prizes.length > 0) {
        const normalizedPrizes = normalizePrizes(payload.prizes);
        const maxWinners = normalizedPrizes.length
          ? Math.max(...normalizedPrizes.map((prize) => prize.position))
          : 1;

        if (normalizedPrizes.length > 0) {
          await admin.from('contest_prizes').insert(
            normalizedPrizes.map((prize) => ({
              contest_id: contestId,
              position: prize.position,
              amount_cents: prize.amount_cents,
              percentage: prize.percentage,
            }))
          );

          // Mettre à jour max_winners
          await admin
            .from('contests')
            .update({ max_winners: maxWinners })
            .eq('id', contestId);
        }
      }
    }

    // Audit log
    const ipHeader = req.headers.get('x-forwarded-for') ?? undefined;
    const ua = req.headers.get('user-agent') ?? undefined;
    const { error: auditError } = await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'contest_update_draft',
      table_name: 'contests',
      row_pk: contestId,
      new_values: payload,
      ip: ipHeader,
      user_agent: ua,
    });
    if (auditError) {
      // Ne bloque pas la réponse, mais journalise pour investigation
      console.error('Audit log failed for contest_update_draft', auditError);
    }

    return NextResponse.json({ ok: true, contest_id: contestId });
  } catch (error) {
    console.error('Error in PATCH /api/contests/[id]/update:', error);
    // S'assurer que l'erreur est toujours retournée en JSON
    if (error && typeof error === 'object' && 'httpStatus' in error && 'code' in error) {
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

function extractPlatforms(
  allowed?: { tiktok?: boolean; instagram?: boolean; youtube?: boolean }
): AllowedPlatform[] {
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

function normalizePrizes(prizes?: Array<{ rank_from: number; rank_to?: number; amount_cents?: number; percentage?: number }>): NormalizedPrize[] {
  if (!prizes?.length) return [];

  const normalized: NormalizedPrize[] = [];
  const seen = new Set<number>();

  for (const prize of prizes) {
    const rankTo = prize.rank_to ?? prize.rank_from;
    for (let position = prize.rank_from; position <= rankTo; position += 1) {
      if (seen.has(position)) {
        throw createError(
          'VALIDATION_ERROR',
          `La position ${position} est déjà définie dans les récompenses`,
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

