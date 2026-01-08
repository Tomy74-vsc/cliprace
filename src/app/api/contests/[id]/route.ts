/*
Source: GET /api/contests/[id]
Effects: récupérer un concours (pour charger un brouillon dans le wizard)
Rules: brand owner or admin; only drafts can be loaded in wizard
*/
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getUserRole } from '@/lib/auth';
import { createError, formatErrorResponse } from '@/lib/errors';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
      throw createError('FORBIDDEN', 'Seules les marques ou admins peuvent accéder à ce concours', 403);
    }

    const admin = getSupabaseAdmin();

    // Récupérer le concours avec toutes les données nécessaires pour le wizard
    const { data: contest, error: contestError } = await admin
      .from('contests')
      .select(
        `
        id,
        title,
        brief_md,
        cover_url,
        status,
        prize_pool_cents,
        currency,
        start_at,
        end_at,
        networks,
        brand_id,
        contest_terms_id,
        contest_terms:contest_terms_id (
          id,
          version,
          terms_markdown,
          terms_url
        ),
        contest_assets (
          id,
          url,
          type
        ),
        contest_prizes (
          id,
          position,
          amount_cents,
          percentage
        )
      `
      )
      .eq('id', contestId)
      .single();

    if (contestError || !contest) {
      throw createError('NOT_FOUND', 'Concours introuvable', 404);
    }

    const isOwner = contest.brand_id === user.id;
    const isAdmin = role === 'admin';
    if (!isOwner && !isAdmin) {
      throw createError('FORBIDDEN', 'Tu n\'as pas les droits pour accéder à ce concours', 403);
    }

    const contestTerms = Array.isArray(contest.contest_terms)
      ? contest.contest_terms[0] ?? null
      : contest.contest_terms ?? null;

    // Formater la réponse pour le wizard
    const formattedContest = {
      id: contest.id,
      title: contest.title,
      brief_md: contest.brief_md,
      cover_url: contest.cover_url,
      status: contest.status,
      prize_pool_cents: contest.prize_pool_cents,
      currency: contest.currency,
      start_at: contest.start_at,
      end_at: contest.end_at,
      brand_id: contest.brand_id, // Ajouter brand_id pour la vérification de propriété
      networks: contest.networks || [],
      contest_terms: contestTerms
        ? {
            version: contestTerms.version,
            terms_markdown: contestTerms.terms_markdown,
            terms_url: contestTerms.terms_url,
          }
        : null,
      assets: (contest.contest_assets || []).map((asset: UnsafeAny) => ({
        url: asset.url,
        type: asset.type,
      })),
      prizes: (contest.contest_prizes || [])
        .sort((a: UnsafeAny, b: UnsafeAny) => a.position - b.position)
        .map((prize: UnsafeAny) => ({
          position: prize.position,
          amount_cents: prize.amount_cents,
          percentage: prize.percentage,
        })),
    };

    return NextResponse.json({ ok: true, contest: formattedContest });
  } catch (error) {
    return formatErrorResponse(error);
  }
}


