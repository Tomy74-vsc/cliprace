import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { createError, formatErrorResponse } from '@/lib/errors';

const QuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
});

type LedgerEntry = {
  id: string;
  type: 'payment' | 'cashout' | 'winning';
  amount_cents: number;
  currency: string;
  status: string;
  created_at: string;
  user_id: string | null;
  contest_id: string | null;
};

export async function GET(req: NextRequest) {
  try {
    await requireAdminPermission('finance.read');
    const parsed = QuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
    const limit = parsed.success ? parsed.data.limit : 50;

    const admin = getAdminClient();

    const [paymentsRes, cashoutsRes, winningsRes] = await Promise.all([
      admin
        .from('payments_brand')
        .select('id, amount_cents, currency, status, created_at, brand_id, contest_id')
        .order('created_at', { ascending: false })
        .limit(limit),
      admin
        .from('cashouts')
        .select('id, amount_cents, currency, status, requested_at, processed_at, creator_id')
        .order('requested_at', { ascending: false })
        .limit(limit),
      admin
        .from('contest_winnings')
        .select('id, payout_cents, created_at, paid_at, creator_id, contest_id')
        .order('created_at', { ascending: false })
        .limit(limit),
    ]);

    if (paymentsRes.error) {
      throw createError('DATABASE_ERROR', 'Failed to load payments', 500, paymentsRes.error.message);
    }
    if (cashoutsRes.error) {
      throw createError('DATABASE_ERROR', 'Failed to load cashouts', 500, cashoutsRes.error.message);
    }
    if (winningsRes.error) {
      throw createError('DATABASE_ERROR', 'Failed to load winnings', 500, winningsRes.error.message);
    }

    const payments: LedgerEntry[] = (paymentsRes.data ?? []).map((row) => ({
      id: row.id,
      type: 'payment',
      amount_cents: row.amount_cents ?? 0,
      currency: row.currency ?? 'EUR',
      status: row.status,
      created_at: row.created_at,
      user_id: row.brand_id ?? null,
      contest_id: row.contest_id ?? null,
    }));

    const cashouts: LedgerEntry[] = (cashoutsRes.data ?? []).map((row) => ({
      id: row.id,
      type: 'cashout',
      amount_cents: row.amount_cents ?? 0,
      currency: row.currency ?? 'EUR',
      status: row.status,
      created_at: row.requested_at,
      user_id: row.creator_id ?? null,
      contest_id: null,
    }));

    const winnings: LedgerEntry[] = (winningsRes.data ?? []).map((row) => ({
      id: row.id,
      type: 'winning',
      amount_cents: row.payout_cents ?? 0,
      currency: 'EUR',
      status: row.paid_at ? 'paid' : 'pending',
      created_at: row.created_at,
      user_id: row.creator_id ?? null,
      contest_id: row.contest_id ?? null,
    }));

    const merged = [...payments, ...cashouts, ...winnings].sort((a, b) =>
      b.created_at.localeCompare(a.created_at)
    );

    const limited = merged.slice(0, limit);
    const userIds = Array.from(new Set(limited.map((entry) => entry.user_id).filter(Boolean))) as string[];
    const contestIds = Array.from(
      new Set(limited.map((entry) => entry.contest_id).filter(Boolean))
    ) as string[];

    const [usersRes, contestsRes] = await Promise.all([
      userIds.length
        ? admin.from('profiles').select('id, display_name, email').in('id', userIds)
        : Promise.resolve({ data: [], error: null }),
      contestIds.length
        ? admin.from('contests').select('id, title').in('id', contestIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (usersRes.error) {
      throw createError('DATABASE_ERROR', 'Failed to load users', 500, usersRes.error.message);
    }
    if (contestsRes.error) {
      throw createError('DATABASE_ERROR', 'Failed to load contests', 500, contestsRes.error.message);
    }

    const usersMap = new Map((usersRes.data ?? []).map((user) => [user.id, user]));
    const contestsMap = new Map((contestsRes.data ?? []).map((contest) => [contest.id, contest]));

    const items = limited.map((entry) => ({
      ...entry,
      user: entry.user_id ? usersMap.get(entry.user_id) ?? null : null,
      contest: entry.contest_id ? contestsMap.get(entry.contest_id) ?? null : null,
    }));

    return NextResponse.json({ items });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
