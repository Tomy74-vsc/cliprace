import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { adminCache, cacheKey, CACHE_TTL } from '@/lib/admin/cache';
import { createError, formatErrorResponse } from '@/lib/errors';

const RangeSchema = z.enum(['today', '7d', '30d']).default('7d');

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getRangeDates(range: z.infer<typeof RangeSchema>) {
  const now = new Date();
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)
  );
  const start = new Date(end);

  const days = range === 'today' ? 1 : range === '7d' ? 7 : 30;
  start.setUTCDate(end.getUTCDate() - (days - 1));
  start.setUTCHours(0, 0, 0, 0);

  return {
    startDate: toDateString(start),
    endDate: toDateString(end),
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireAdminPermission('dashboard.read');

    const parsed = RangeSchema.safeParse(req.nextUrl.searchParams.get('range') || undefined);
    const range = parsed.success ? parsed.data : '7d';
    const { startDate, endDate, startIso, endIso } = getRangeDates(range);

    const admin = getAdminClient();

    const key = cacheKey('admin:kpis', { user_id: user.id, range, start: startDate, end: endDate });

    const payload = await adminCache.getOrSet(
      key,
      async () => {
        // Run independent queries in parallel
        const [
          metricsRes,
          newUsersRes,
          activeContestsRes,
          paymentsRes,
          winningsRes,
          pendingSubmissionsRes,
          pendingCashoutsRes,
          stripeAlertsRes,
          ingestionAlertsRes,
          auditAlertsRes,
        ] = await Promise.all([
          admin
            .from('metrics_daily')
            .select('metric_date, views, likes, comments, shares')
            .gte('metric_date', startDate)
            .lte('metric_date', endDate)
            .order('metric_date', { ascending: true }),
          admin
            .from('profiles')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', startIso)
            .lte('created_at', endIso),
          admin.from('contests').select('id', { count: 'exact', head: true }).eq('status', 'active'),
          admin
            .from('payments_brand')
            .select('amount_cents, status, created_at')
            .gte('created_at', startIso)
            .lte('created_at', endIso),
          admin
            .from('contest_winnings')
            .select('payout_cents, paid_at')
            .not('paid_at', 'is', null)
            .gte('paid_at', startIso)
            .lte('paid_at', endIso),
          admin.from('submissions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
          admin.from('cashouts').select('amount_cents, status').in('status', ['requested', 'processing']),
          admin
            .from('webhooks_stripe')
            .select('stripe_event_id, event_type, created_at')
            .eq('processed', false)
            .order('created_at', { ascending: false })
            .limit(5),
          admin
            .from('ingestion_errors')
            .select('id, error_code, created_at, details')
            .order('created_at', { ascending: false })
            .limit(5),
          admin
            .from('audit_logs')
            .select('id, action, table_name, created_at, actor_id')
            .order('created_at', { ascending: false })
            .limit(5),
        ]);

        if (metricsRes.error) throw createError('DATABASE_ERROR', 'Failed to load metrics', 500, metricsRes.error.message);
        if (newUsersRes.error) throw createError('DATABASE_ERROR', 'Failed to load users', 500, newUsersRes.error.message);
        if (activeContestsRes.error)
          throw createError('DATABASE_ERROR', 'Failed to load contests', 500, activeContestsRes.error.message);
        if (paymentsRes.error) throw createError('DATABASE_ERROR', 'Failed to load payments', 500, paymentsRes.error.message);
        if (winningsRes.error) throw createError('DATABASE_ERROR', 'Failed to load winnings', 500, winningsRes.error.message);
        if (pendingSubmissionsRes.error)
          throw createError('DATABASE_ERROR', 'Failed to load pending submissions', 500, pendingSubmissionsRes.error.message);
        if (pendingCashoutsRes.error)
          throw createError('DATABASE_ERROR', 'Failed to load cashouts', 500, pendingCashoutsRes.error.message);
        if (stripeAlertsRes.error)
          throw createError('DATABASE_ERROR', 'Failed to load Stripe alerts', 500, stripeAlertsRes.error.message);
        if (ingestionAlertsRes.error)
          throw createError('DATABASE_ERROR', 'Failed to load ingestion alerts', 500, ingestionAlertsRes.error.message);
        if (auditAlertsRes.error)
          throw createError('DATABASE_ERROR', 'Failed to load audit logs', 500, auditAlertsRes.error.message);

        const dailyMap = new Map<string, { views: number; likes: number; comments: number; shares: number }>();
        for (const row of metricsRes.data ?? []) {
          const d = row.metric_date as string;
          const current = dailyMap.get(d) || { views: 0, likes: 0, comments: 0, shares: 0 };
          current.views += row.views ?? 0;
          current.likes += row.likes ?? 0;
          current.comments += row.comments ?? 0;
          current.shares += row.shares ?? 0;
          dailyMap.set(d, current);
        }

        const series = Array.from(dailyMap.entries())
          .map(([date, values]) => ({ date, ...values }))
          .sort((a, b) => a.date.localeCompare(b.date));

        const totals = series.reduce(
          (acc, item) => {
            acc.views += item.views;
            acc.likes += item.likes;
            acc.comments += item.comments;
            acc.shares += item.shares;
            return acc;
          },
          { views: 0, likes: 0, comments: 0, shares: 0 }
        );

        let amountCollectedCents = 0;
        let amountPendingCents = 0;
        for (const payment of paymentsRes.data ?? []) {
          if (payment.status === 'succeeded') amountCollectedCents += payment.amount_cents ?? 0;
          if (payment.status === 'requires_payment' || payment.status === 'processing') amountPendingCents += payment.amount_cents ?? 0;
        }

        const amountDistributedCents = (winningsRes.data ?? []).reduce((sum, row) => sum + (row.payout_cents ?? 0), 0);
        const commissionRate = 0.15;
        const commissionCents = Math.round(amountCollectedCents * commissionRate);

        const pendingCashoutsCount = (pendingCashoutsRes.data ?? []).length;
        const pendingCashoutsCents = (pendingCashoutsRes.data ?? []).reduce((sum, row) => sum + (row.amount_cents ?? 0), 0);

        return {
          range,
          range_start: startDate,
          range_end: endDate,
          kpis: {
            views: totals.views,
            likes: totals.likes,
            comments: totals.comments,
            shares: totals.shares,
            engagement: totals.likes + totals.comments + totals.shares,
            new_users: newUsersRes.count ?? 0,
            active_contests: activeContestsRes.count ?? 0,
            amount_collected_cents: amountCollectedCents,
            amount_pending_cents: amountPendingCents,
            amount_distributed_cents: amountDistributedCents,
            commission_cents: commissionCents,
            commission_rate: commissionRate,
          },
          series,
          alerts: {
            stripe: stripeAlertsRes.data ?? [],
            ingestion: ingestionAlertsRes.data ?? [],
            audit: auditAlertsRes.data ?? [],
          },
          shortcuts: {
            pending_submissions: pendingSubmissionsRes.count ?? 0,
            pending_cashouts: pendingCashoutsCount,
            pending_cashouts_cents: pendingCashoutsCents,
          },
        };
      },
      CACHE_TTL.SHORT
    );

    return NextResponse.json(payload);
  } catch (error) {
    return formatErrorResponse(error);
  }
}
