import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { createError, formatErrorResponse } from '@/lib/errors';

const QuerySchema = z.object({
  status: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  page: z.coerce.number().min(1).default(1),
});

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireAdminPermission('moderation.read');
    const parsed = QuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
    const query = parsed.success ? parsed.data : QuerySchema.parse({});
    const limit = query.limit;
    const from = (query.page - 1) * limit;
    const to = from + limit - 1;

    const admin = getAdminClient();
    let queueQuery = admin
      .from('moderation_queue')
      .select('id, submission_id, reason, status, reviewed_by, reviewed_at, created_at, updated_at', {
        count: 'exact',
      })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (query.status) {
      queueQuery = queueQuery.eq('status', query.status);
    }

    const { data: queueRows, error, count } = await queueQuery;
    if (error) {
      throw createError('DATABASE_ERROR', 'Failed to load moderation queue', 500, error.message);
    }

    const submissionIds = (queueRows ?? []).map((row) => row.submission_id);
    if (submissionIds.length === 0) {
      return NextResponse.json({
        items: [],
        pagination: {
          total: count ?? 0,
          page: query.page,
          limit,
        },
      });
    }

    const reviewerIds = (queueRows ?? [])
      .map((row) => row.reviewed_by)
      .filter((id): id is string => Boolean(id));

    const { data: submissions, error: submissionsError } = await admin
      .from('submissions')
      .select('id, contest_id, creator_id, external_url, title, thumbnail_url, status, submitted_at')
      .in('id', submissionIds);
    if (submissionsError) {
      throw createError('DATABASE_ERROR', 'Failed to load submissions', 500, submissionsError.message);
    }

    const contestIds = Array.from(new Set((submissions ?? []).map((sub) => sub.contest_id)));
    const creatorIds = Array.from(new Set((submissions ?? []).map((sub) => sub.creator_id)));

    const { data: contests, error: contestsError } =
      contestIds.length === 0
        ? { data: [], error: null }
        : await admin.from('contests').select('id, title').in('id', contestIds);
    if (contestsError) {
      throw createError('DATABASE_ERROR', 'Failed to load contests', 500, contestsError.message);
    }

    const { data: creators, error: creatorsError } =
      creatorIds.length === 0
        ? { data: [], error: null }
        : await admin.from('profiles').select('id, display_name, email').in('id', creatorIds);
    if (creatorsError) {
      throw createError('DATABASE_ERROR', 'Failed to load creators', 500, creatorsError.message);
    }

    const { data: reviewers, error: reviewersError } =
      reviewerIds.length === 0
        ? { data: [], error: null }
        : await admin.from('profiles').select('id, display_name, email').in('id', reviewerIds);
    if (reviewersError) {
      throw createError('DATABASE_ERROR', 'Failed to load reviewers', 500, reviewersError.message);
    }

    const { data: metricsRows, error: metricsError } = await admin
      .from('metrics_daily')
      .select('submission_id, views, likes, comments, shares')
      .in('submission_id', submissionIds);
    if (metricsError) {
      throw createError('DATABASE_ERROR', 'Failed to load metrics', 500, metricsError.message);
    }

    const submissionsMap = new Map((submissions ?? []).map((sub) => [sub.id, sub]));
    const contestsMap = new Map((contests ?? []).map((contest) => [contest.id, contest]));
    const creatorsMap = new Map((creators ?? []).map((creator) => [creator.id, creator]));
    const reviewersMap = new Map((reviewers ?? []).map((reviewer) => [reviewer.id, reviewer]));
    const metricsMap = new Map<string, { views: number; likes: number; comments: number; shares: number }>();

    for (const row of metricsRows ?? []) {
      const current = metricsMap.get(row.submission_id) || {
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
      };
      current.views += row.views ?? 0;
      current.likes += row.likes ?? 0;
      current.comments += row.comments ?? 0;
      current.shares += row.shares ?? 0;
      metricsMap.set(row.submission_id, current);
    }

    const items = (queueRows ?? []).map((row) => {
      const submission = submissionsMap.get(row.submission_id);
      return {
        ...row,
        submission: submission
          ? {
              ...submission,
              contest: contestsMap.get(submission.contest_id) ?? null,
              creator: creatorsMap.get(submission.creator_id) ?? null,
            }
          : null,
        reviewer: row.reviewed_by ? reviewersMap.get(row.reviewed_by) ?? null : null,
        metrics: metricsMap.get(row.submission_id) ?? {
          views: 0,
          likes: 0,
          comments: 0,
          shares: 0,
        },
        locked_by_me: row.reviewed_by === user.id,
      };
    });

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
