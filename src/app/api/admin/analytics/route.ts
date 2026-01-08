import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { createError, formatErrorResponse } from '@/lib/errors';

function toDateStringUTC(date: Date) {
  return date.toISOString().slice(0, 10);
}

/**
 * GET /api/admin/analytics
 * 
 * Retourne des données analytics pour graphiques :
 * - timeSeries: évolution temporelle (vues, engagement, revenus, users)
 * - funnel: funnel de conversion
 * - cohorts: rétention par cohorte
 * - distribution: répartition par catégorie
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdminPermission('dashboard.read');

    const searchParams = req.nextUrl.searchParams;
    const type = searchParams.get('type') || 'timeSeries';
    const range = searchParams.get('range') || '30d';
    const startDate = searchParams.get('start');
    const endDate = searchParams.get('end');

    const admin = getAdminClient();
    const now = new Date();
    let start: Date;
    let end: Date = now;

    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else {
      const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 30;
      start = new Date(now);
      start.setDate(start.getDate() - days);
    }

    if (type === 'timeSeries') {
      // Évolution temporelle
      const dates: string[] = [];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push(toDateStringUTC(d));
      }

      const metricsRes = await admin
        .from('metrics_daily')
        .select('metric_date, views, likes, comments, shares')
        .in('metric_date', dates);

      if (metricsRes.error) {
        throw createError('DATABASE_ERROR', 'Failed to load metrics', 500, metricsRes.error.message);
      }

      const usersRes = await admin
        .from('profiles')
        .select('created_at')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      if (usersRes.error) {
        throw createError('DATABASE_ERROR', 'Failed to load users', 500, usersRes.error.message);
      }

      const paymentsRes = await admin
        .from('payments_brand')
        .select('amount_cents, created_at, status')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .eq('status', 'succeeded');

      if (paymentsRes.error) {
        throw createError('DATABASE_ERROR', 'Failed to load payments', 500, paymentsRes.error.message);
      }

      // Agrégation par jour
      const dailyData = new Map<string, { views: number; engagement: number; revenue_cents: number; users: number }>();

      dates.forEach((date) => {
        dailyData.set(date, { views: 0, engagement: 0, revenue_cents: 0, users: 0 });
      });

      // Métriques
      (metricsRes.data ?? []).forEach((row) => {
        const date = row.metric_date as string;
        const current = dailyData.get(date) || { views: 0, engagement: 0, revenue_cents: 0, users: 0 };
        current.views += row.views ?? 0;
        current.engagement += (row.likes ?? 0) + (row.comments ?? 0) + (row.shares ?? 0);
        dailyData.set(date, current);
      });

      // Utilisateurs
      (usersRes.data ?? []).forEach((row) => {
        const date = toDateStringUTC(new Date(row.created_at as string));
        const current = dailyData.get(date);
        if (current) {
          current.users += 1;
        }
      });

      // Revenus
      (paymentsRes.data ?? []).forEach((row) => {
        const date = toDateStringUTC(new Date(row.created_at as string));
        const current = dailyData.get(date);
        if (current) {
          current.revenue_cents += row.amount_cents ?? 0;
        }
      });

      const timeSeries = Array.from(dailyData.entries())
        .map(([date, values]) => ({
          date,
          ...values,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return NextResponse.json({ ok: true, type: 'timeSeries', data: timeSeries });
    }

    if (type === 'funnel') {
      // Funnel de conversion
      const submissionsRes = await admin
        .from('submissions')
        .select('status, created_at')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      if (submissionsRes.error) {
        throw createError('DATABASE_ERROR', 'Failed to load submissions', 500, submissionsRes.error.message);
      }

      const total = submissionsRes.data?.length ?? 0;
      const pending = submissionsRes.data?.filter((s) => s.status === 'pending').length ?? 0;
      const approved = submissionsRes.data?.filter((s) => s.status === 'approved').length ?? 0;
      const rejected = submissionsRes.data?.filter((s) => s.status === 'rejected').length ?? 0;

      const funnel = [
        { stage: 'Soumissions totales', value: total, percentage: 100 },
        { stage: 'En attente', value: pending, percentage: total > 0 ? (pending / total) * 100 : 0 },
        { stage: 'Approuvées', value: approved, percentage: total > 0 ? (approved / total) * 100 : 0 },
        { stage: 'Rejetées', value: rejected, percentage: total > 0 ? (rejected / total) * 100 : 0 },
      ];

      return NextResponse.json({ ok: true, type: 'funnel', data: funnel });
    }

    if (type === 'cohorts') {
      // Rétention par cohorte (simplifié : semaines)
      const usersRes = await admin
        .from('profiles')
        .select('id, created_at')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: true });

      if (usersRes.error) {
        throw createError('DATABASE_ERROR', 'Failed to load users', 500, usersRes.error.message);
      }

      // Groupement par semaine de création
      const cohorts = new Map<string, string[]>();
      (usersRes.data ?? []).forEach((user) => {
        const created = new Date(user.created_at as string);
        const weekStart = new Date(created);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekKey = toDateStringUTC(weekStart);
        const current = cohorts.get(weekKey) || [];
        current.push(user.id);
        cohorts.set(weekKey, current);
      });

      // Calcul de rétention (simplifié : activité dans les semaines suivantes)
      const cohortData = Array.from(cohorts.entries()).map(([cohort, userIds]) => {
        const week0 = userIds.length;
        // TODO: Calculer réellement l'activité dans les semaines suivantes
        // Pour l'instant, on simule
        const week1 = Math.round(week0 * 0.7);
        const week2 = Math.round(week0 * 0.5);
        const week3 = Math.round(week0 * 0.3);
        const week4 = Math.round(week0 * 0.2);

        return {
          cohort: new Date(cohort).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' }),
          week0,
          week1,
          week2,
          week3,
          week4,
        };
      });

      return NextResponse.json({ ok: true, type: 'cohorts', data: cohortData });
    }

    if (type === 'distribution') {
      // Répartition par catégorie
      const submissionsRes = await admin
        .from('submissions')
        .select('platform')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      if (submissionsRes.error) {
        throw createError('DATABASE_ERROR', 'Failed to load submissions', 500, submissionsRes.error.message);
      }

      const platformCounts = new Map<string, number>();
      (submissionsRes.data ?? []).forEach((s) => {
        const platform = (s.platform as string) || 'unknown';
        platformCounts.set(platform, (platformCounts.get(platform) || 0) + 1);
      });

      const distribution = Array.from(platformCounts.entries()).map(([name, value]) => ({
        name,
        value,
      }));

      return NextResponse.json({ ok: true, type: 'distribution', data: distribution });
    }

    throw createError('VALIDATION_ERROR', 'Type invalide', 400, { type });
  } catch (error) {
    return formatErrorResponse(error);
  }
}

