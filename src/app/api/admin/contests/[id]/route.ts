import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { createError, formatErrorResponse } from '@/lib/errors';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminPermission('contests.read');
    const { id: contestId } = await context.params;
    const admin = getAdminClient();

    const { data: contest, error: contestError } = await admin
      .from('contests')
      .select(
        'id, title, slug, status, brief_md, cover_url, start_at, end_at, budget_cents, prize_pool_cents, currency, max_winners, brand_id, org_id, created_at, updated_at, brand:profiles(id, display_name, email), org:orgs(id, name)',
      )
      .eq('id', contestId)
      .single();

    if (contestError || !contest) {
      throw createError('NOT_FOUND', 'Contest not found', 404, contestError?.message);
    }

    const { data: stats, error: statsError } = await admin
      .from('contest_stats')
      .select(
        'contest_id, total_submissions, total_creators, approved_submissions, total_views, total_likes, total_comments, total_shares, total_weighted_views'
      )
      .eq('contest_id', contestId)
      .maybeSingle();

    if (statsError) {
      throw createError('DATABASE_ERROR', 'Failed to load contest stats', 500, statsError.message);
    }

    let leaderboardRows:
      | Array<{
          creator_id: string;
          total_weighted_views: number;
          total_views: number;
          total_likes: number;
          total_comments: number;
          total_shares: number;
          submission_count: number;
        }>
      | null = null;

    let leaderboardError = null as { message?: string } | null;
    const leaderboardRes = await admin
      .from('leaderboard_materialized')
      .select(
        'creator_id, total_weighted_views, total_views, total_likes, total_comments, total_shares, submission_count'
      )
      .eq('contest_id', contestId)
      .order('total_weighted_views', { ascending: false })
      .limit(20);

    if (!leaderboardRes.error) {
      leaderboardRows = leaderboardRes.data ?? [];
    } else {
      leaderboardError = leaderboardRes.error;
    }

    if (!leaderboardRows && leaderboardError) {
      const fallbackRes = await admin
        .from('leaderboard')
        .select(
          'creator_id, total_weighted_views, total_views, total_likes, total_comments, total_shares, submission_count'
        )
        .eq('contest_id', contestId)
        .order('total_weighted_views', { ascending: false })
        .limit(20);
      if (fallbackRes.error) {
        throw createError(
          'DATABASE_ERROR',
          'Failed to load leaderboard',
          500,
          fallbackRes.error.message
        );
      }
      leaderboardRows = fallbackRes.data ?? [];
    }

    const creatorIds = (leaderboardRows ?? []).map((row) => row.creator_id);
    let creatorsMap = new Map<string, { id: string; display_name: string | null; email: string }>();
    if (creatorIds.length > 0) {
      const { data: creators, error: creatorsError } = await admin
        .from('profiles')
        .select('id, display_name, email')
        .in('id', creatorIds);
      if (creatorsError) {
        throw createError('DATABASE_ERROR', 'Failed to load creators', 500, creatorsError.message);
      }
      creatorsMap = new Map((creators ?? []).map((creator) => [creator.id, creator]));
    }

    const leaderboard = (leaderboardRows ?? []).map((row, index) => ({
      rank: index + 1,
      ...row,
      creator: creatorsMap.get(row.creator_id) ?? null,
    }));

    const { data: prizes, error: prizesError } = await admin
      .from('contest_prizes')
      .select('id, position, percentage, amount_cents')
      .eq('contest_id', contestId)
      .order('position', { ascending: true });
    if (prizesError) {
      throw createError('DATABASE_ERROR', 'Failed to load prizes', 500, prizesError.message);
    }

    const { data: payments, error: paymentsError } = await admin
      .from('payments_brand')
      .select('id, amount_cents, currency, status, created_at')
      .eq('contest_id', contestId)
      .order('created_at', { ascending: false });
    if (paymentsError) {
      throw createError('DATABASE_ERROR', 'Failed to load payments', 500, paymentsError.message);
    }

    const { data: statusHistory, error: statusError } = await admin
      .from('status_history')
      .select('id, old_status, new_status, created_at, changed_by, reason')
      .eq('table_name', 'contests')
      .eq('row_id', contestId)
      .order('created_at', { ascending: false })
      .limit(10);
    if (statusError) {
      throw createError('DATABASE_ERROR', 'Failed to load status history', 500, statusError.message);
    }

    const { data: auditLogs, error: auditError } = await admin
      .from('audit_logs')
      .select('id, action, created_at, actor_id')
      .eq('table_name', 'contests')
      .eq('row_pk', contestId)
      .order('created_at', { ascending: false })
      .limit(10);
    if (auditError) {
      throw createError('DATABASE_ERROR', 'Failed to load audit logs', 500, auditError.message);
    }

    return NextResponse.json({
      contest,
      stats: stats ?? null,
      leaderboard,
      prizes: prizes ?? [],
      payments: payments ?? [],
      status_history: statusHistory ?? [],
      audit_logs: auditLogs ?? [],
    });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
