import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { createError, formatErrorResponse } from '@/lib/errors';

const QuerySchema = z.object({
  submission_id: z.string().uuid().optional(),
  status: z.string().optional(),
  q: z.string().optional(),
  contest_id: z.string().uuid().optional(),
  creator_id: z.string().uuid().optional(),
  brand_id: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  page: z.coerce.number().min(1).default(1),
});

export async function GET(req: NextRequest) {
  try {
    await requireAdminPermission('submissions.read');
    const parsed = QuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
    const query = parsed.success ? parsed.data : QuerySchema.parse({});
    const limit = query.limit;
    const from = (query.page - 1) * limit;
    const to = from + limit - 1;

    const admin = getAdminClient();

    let contestFilterIds: string[] | null = null;
    if (query.brand_id) {
      const { data: contests, error: contestError } = await admin
        .from('contests')
        .select('id')
        .eq('brand_id', query.brand_id);
      if (contestError) {
        throw createError('DATABASE_ERROR', 'Failed to load contests', 500, contestError.message);
      }
      contestFilterIds = (contests ?? []).map((row) => row.id);
      if (contestFilterIds.length === 0) {
        return NextResponse.json({
          items: [],
          pagination: { total: 0, page: query.page, limit },
        });
      }
    }

    let submissionsQuery = admin
      .from('submissions')
      .select(
        'id, contest_id, creator_id, platform, external_url, title, thumbnail_url, status, rejection_reason, submitted_at, approved_at, created_at, contest:contests(id, title, brand_id), creator:profiles(id, display_name, email)',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    if (query.submission_id) {
      submissionsQuery = submissionsQuery.eq('id', query.submission_id);
    }
    if (query.status) {
      submissionsQuery = submissionsQuery.eq('status', query.status);
    }
    if (query.contest_id) {
      submissionsQuery = submissionsQuery.eq('contest_id', query.contest_id);
    }
    if (query.creator_id) {
      submissionsQuery = submissionsQuery.eq('creator_id', query.creator_id);
    }
    if (contestFilterIds) {
      submissionsQuery = submissionsQuery.in('contest_id', contestFilterIds);
    }
    if (query.q) {
      const q = `%${query.q}%`;
      submissionsQuery = submissionsQuery.or(`external_url.ilike.${q},title.ilike.${q}`);
    }

    const { data: submissions, error, count } = await submissionsQuery;
    if (error) {
      throw createError('DATABASE_ERROR', 'Failed to load submissions', 500, error.message);
    }

    const submissionIds = (submissions ?? []).map((submission) => submission.id);
    let metricsMap = new Map<string, { views: number; likes: number; comments: number; shares: number }>();
    if (submissionIds.length > 0) {
      const { data: metricsRows, error: metricsError } = await admin
        .from('metrics_daily')
        .select('submission_id, views, likes, comments, shares')
        .in('submission_id', submissionIds);
      if (metricsError) {
        throw createError('DATABASE_ERROR', 'Failed to load metrics', 500, metricsError.message);
      }

      metricsMap = new Map();
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
    }

    const items = (submissions ?? []).map((submission) => ({
      ...submission,
      metrics: metricsMap.get(submission.id) ?? {
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
      },
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
