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
    await requireAdminPermission('finance.read');
    const parsed = QuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
    const query = parsed.success ? parsed.data : QuerySchema.parse({});
    const limit = query.limit;
    const from = (query.page - 1) * limit;
    const to = from + limit - 1;

    const admin = getAdminClient();
    let cashoutsQuery = admin
      .from('cashouts')
      .select(
        'id, creator_id, amount_cents, currency, status, metadata, requested_at, processed_at, created_at, updated_at',
        { count: 'exact' }
      )
      .order('requested_at', { ascending: false })
      .range(from, to);

    if (query.status) {
      cashoutsQuery = cashoutsQuery.eq('status', query.status);
    }

    const { data: cashouts, error, count } = await cashoutsQuery;
    if (error) {
      throw createError('DATABASE_ERROR', 'Failed to load cashouts', 500, error.message);
    }

    const creatorIds = Array.from(new Set((cashouts ?? []).map((row) => row.creator_id)));
    const { data: creators, error: creatorsError } = creatorIds.length
      ? await admin.from('profiles').select('id, display_name, email').in('id', creatorIds)
      : { data: [], error: null };
    if (creatorsError) {
      throw createError('DATABASE_ERROR', 'Failed to load creators', 500, creatorsError.message);
    }

    const { data: kycs, error: kycError } = creatorIds.length
      ? await admin
          .from('kyc_checks')
          .select('user_id, status, provider, reason, reviewed_at')
          .in('user_id', creatorIds)
      : { data: [], error: null };
    if (kycError) {
      throw createError('DATABASE_ERROR', 'Failed to load KYC', 500, kycError.message);
    }

    const { data: riskFlags, error: riskError } = creatorIds.length
      ? await admin
          .from('risk_flags')
          .select('user_id, severity, resolved_at')
          .in('user_id', creatorIds)
      : { data: [], error: null };
    if (riskError) {
      throw createError('DATABASE_ERROR', 'Failed to load risk flags', 500, riskError.message);
    }

    const creatorsMap = new Map((creators ?? []).map((creator) => [creator.id, creator]));
    const kycMap = new Map((kycs ?? []).map((kyc) => [kyc.user_id, kyc]));
    const riskCounts = new Map<string, number>();
    for (const flag of riskFlags ?? []) {
      if (flag.resolved_at) continue;
      riskCounts.set(flag.user_id, (riskCounts.get(flag.user_id) ?? 0) + 1);
    }

    const items = (cashouts ?? []).map((cashout) => ({
      ...cashout,
      creator: creatorsMap.get(cashout.creator_id) ?? null,
      kyc: kycMap.get(cashout.creator_id) ?? null,
      open_risk_flags: riskCounts.get(cashout.creator_id) ?? 0,
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
