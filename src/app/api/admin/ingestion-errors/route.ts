import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { createError, formatErrorResponse } from '@/lib/errors';

const QuerySchema = z.object({
  job_id: z.coerce.number().optional(),
  error_code: z.string().optional(),
  q: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  page: z.coerce.number().min(1).default(1),
});

type IngestionErrorRow = {
  id: number;
  job_id: number;
  error_code: string;
  details: unknown;
  created_at: string;
  job: { id: number; account_id: string; kind: string; status: string } | null;
};

export async function GET(req: NextRequest) {
  try {
    await requireAdminPermission('ingestion.read');
    const parsed = QuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
    const query = parsed.success ? parsed.data : QuerySchema.parse({});
    const limit = query.limit;
    const from = (query.page - 1) * limit;
    const to = from + limit - 1;

    const admin = getAdminClient();

    const selectV2 =
      'id, job_id, error_code, details, is_resolved, resolved_at, resolved_by, created_at, job:ingestion_jobs(id, account_id, kind, status)';
    const selectV1 = 'id, job_id, error_code, details, created_at, job:ingestion_jobs(id, account_id, kind, status)';

    const runQuery = async (select: string) => {
      let q: any = admin
        .from('ingestion_errors')
        .select(select, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (query.job_id) q = q.eq('job_id', query.job_id);
      if (query.error_code) q = q.eq('error_code', query.error_code);
      if (query.q) {
        const like = `%${query.q.trim()}%`;
        q = q.or(`error_code.ilike.${like}`);
      }

      return await q;
    };

    let res: any = await runQuery(selectV2);
    if (res?.error && res.error.message?.includes('column \"is_resolved\"')) {
      res = await runQuery(selectV1);
    }

    const { data: items, error, count } = res;
    if (error) {
      throw createError('DATABASE_ERROR', 'Failed to load ingestion errors', 500, error.message);
    }

    const rows = (items ?? []) as unknown as IngestionErrorRow[];

    return NextResponse.json({
      items: rows,
      pagination: { total: count ?? 0, page: query.page, limit },
    });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
