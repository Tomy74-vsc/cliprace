/*
Source: GET /api/contests/[id]/export-pdf
Effects: génère et retourne un PDF des résultats du concours
*/
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { getUserRole } from '@/lib/auth';
import { createError, formatErrorResponse } from '@/lib/errors';
import { pdf, type DocumentProps } from '@react-pdf/renderer';
import { ContestResultsPDF } from '@/components/pdf/contest-results-pdf';
import { createElement, type ReactElement } from 'react';

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
      throw createError('FORBIDDEN', 'Seules les marques ou admins peuvent exporter les résultats', 403);
    }

    const supabase = await getSupabaseSSR();

    // Récupérer le concours
    const { data: contest, error: contestError } = await supabase
      .from('contests')
      .select(
        'id, title, start_at, end_at, prize_pool_cents, currency, brand_id, brand:brand_id(display_name, profile_brands!inner(company_name))'
      )
      .eq('id', contestId)
      .single();

    if (contestError || !contest) {
      throw createError('NOT_FOUND', 'Concours introuvable', 404);
    }

    // Vérifier ownership
    if (contest.brand_id !== user.id && role !== 'admin') {
      throw createError('FORBIDDEN', 'Tu n\'as pas les droits pour exporter ce concours', 403);
    }

    // Récupérer les métriques
    const { data: metricsData } = await supabase.rpc('get_contest_metrics', {
      p_contest_id: contestId,
    });

    const metrics = metricsData && metricsData.length > 0
      ? {
          total_views: Number(metricsData[0].total_views || 0),
          total_likes: Number(metricsData[0].total_likes || 0),
          total_comments: Number(metricsData[0].total_comments || 0),
          total_shares: Number(metricsData[0].total_shares || 0),
          approved_submissions: Number(metricsData[0].approved_submissions || 0),
          total_submissions: Number(metricsData[0].total_submissions || 0),
        }
      : {
          total_views: 0,
          total_likes: 0,
          total_comments: 0,
          total_shares: 0,
          approved_submissions: 0,
          total_submissions: 0,
        };

    // Récupérer le leaderboard
    const { data: leaderboardData } = await supabase.rpc('get_contest_leaderboard', {
      p_contest_id: contestId,
      p_limit: 50,
    });

    // Récupérer les noms des créateurs
    const creatorIds = leaderboardData?.map((l: { creator_id: string }) => l.creator_id) || [];
    const { data: creators } = creatorIds.length > 0
      ? await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', creatorIds)
      : { data: null };

    const creatorMap = new Map(
      (creators || []).map((c) => [c.id, c.display_name || null])
    );

    // Récupérer les prix pour calculer les gains
    const { data: prizes } = await supabase
      .from('contest_prizes')
      .select('position, amount_cents, percentage')
      .eq('contest_id', contestId)
      .order('position', { ascending: true });

    const leaderboard = (leaderboardData || []).map((entry: any, index: number) => {
      const rank = index + 1;
      const prize = prizes?.find((p) => p.position === rank);
      const estimatedPayout = prize
        ? prize.amount_cents || Math.round((contest.prize_pool_cents * (prize.percentage || 0)) / 100)
        : 0;

      return {
        rank,
        creator_name: creatorMap.get(entry.creator_id) || null,
        total_views: Number(entry.total_views || 0),
        total_likes: Number(entry.total_likes || 0),
        estimated_payout_cents: estimatedPayout,
      };
    });

    // Récupérer les vues quotidiennes (7 derniers jours)
    const { data: allSubmissions } = await supabase
      .from('submissions')
      .select('id')
      .eq('contest_id', contestId);

    const submissionIds = allSubmissions?.map((s) => s.id) || [];
    const dailyViews: Array<{ date: string; views: number }> = [];

    if (submissionIds.length > 0) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { data: dailyMetrics } = await supabase
        .from('metrics_daily')
        .select('metric_date, views')
        .in('submission_id', submissionIds)
        .gte('metric_date', sevenDaysAgo.toISOString().split('T')[0])
        .order('metric_date', { ascending: true });

      const viewsByDate = new Map<string, number>();
      dailyMetrics?.forEach((m: { metric_date: string; views: number }) => {
        const date = m.metric_date;
        const current = viewsByDate.get(date) || 0;
        viewsByDate.set(date, current + (m.views || 0));
      });

      // Remplir les 7 derniers jours
      const today = new Date();
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        dailyViews.push({
          date: dateStr,
          views: viewsByDate.get(dateStr) || 0,
        });
      }
    } else {
      // Aucune soumission, remplir avec des zéros
      const today = new Date();
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        dailyViews.push({
          date: date.toISOString().split('T')[0],
          views: 0,
        });
      }
    }

    // Calculer CPV
    const cpv = metrics.total_views > 0
      ? Math.round((contest.prize_pool_cents / metrics.total_views) * 1000)
      : 0;

    // Générer le PDF
    const brandName = (contest.brand as any)?.profile_brands?.company_name ||
                     (contest.brand as any)?.display_name ||
                     'Marque';

    const pdfDoc = createElement(ContestResultsPDF, {
      contest: {
        title: contest.title,
        start_at: contest.start_at,
        end_at: contest.end_at,
        prize_pool_cents: contest.prize_pool_cents,
        currency: contest.currency || 'EUR',
        brand_name: brandName,
      },
      metrics,
      leaderboard,
      dailyViews,
      cpv,
    }) as unknown as ReactElement<DocumentProps>;

    // Générer le PDF
    const pdfInstance = pdf(pdfDoc);
    const pdfBlob = await pdfInstance.toBlob();
    const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer());

    // Retourner le PDF
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="resultats-${contest.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${contestId.slice(0, 8)}.pdf"`,
      },
    });
  } catch (error) {
    return formatErrorResponse(error);
  }
}

