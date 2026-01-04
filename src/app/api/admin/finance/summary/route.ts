import { NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { createError, formatErrorResponse } from '@/lib/errors';

export async function GET() {
  try {
    await requireAdminPermission('finance.read');
    const admin = getAdminClient();

    const paymentsRes = await admin
      .from('payments_brand')
      .select('amount_cents, status');

    if (paymentsRes.error) {
      throw createError('DATABASE_ERROR', 'Failed to load payments', 500, paymentsRes.error.message);
    }

    let collectedCents = 0;
    let pendingCents = 0;
    let refundedCents = 0;
    for (const payment of paymentsRes.data ?? []) {
      if (payment.status === 'succeeded') collectedCents += payment.amount_cents ?? 0;
      if (payment.status === 'requires_payment' || payment.status === 'processing') {
        pendingCents += payment.amount_cents ?? 0;
      }
      if (payment.status === 'refunded') refundedCents += payment.amount_cents ?? 0;
    }

    const winningsRes = await admin
      .from('contest_winnings')
      .select('payout_cents, paid_at');
    if (winningsRes.error) {
      throw createError('DATABASE_ERROR', 'Failed to load winnings', 500, winningsRes.error.message);
    }

    let distributedCents = 0;
    let pendingPayoutsCents = 0;
    for (const win of winningsRes.data ?? []) {
      if (win.paid_at) {
        distributedCents += win.payout_cents ?? 0;
      } else {
        pendingPayoutsCents += win.payout_cents ?? 0;
      }
    }

    const cashoutsRes = await admin
      .from('cashouts')
      .select('amount_cents, status');
    if (cashoutsRes.error) {
      throw createError('DATABASE_ERROR', 'Failed to load cashouts', 500, cashoutsRes.error.message);
    }

    let pendingCashoutsCents = 0;
    let pendingCashoutsCount = 0;
    let failedCashoutsCount = 0;
    for (const cashout of cashoutsRes.data ?? []) {
      if (cashout.status === 'requested' || cashout.status === 'processing') {
        pendingCashoutsCents += cashout.amount_cents ?? 0;
        pendingCashoutsCount += 1;
      }
      if (cashout.status === 'failed') {
        failedCashoutsCount += 1;
      }
    }

    return NextResponse.json({
      payments: {
        collected_cents: collectedCents,
        pending_cents: pendingCents,
        refunded_cents: refundedCents,
      },
      winnings: {
        distributed_cents: distributedCents,
        pending_cents: pendingPayoutsCents,
      },
      cashouts: {
        pending_cents: pendingCashoutsCents,
        pending_count: pendingCashoutsCount,
        failed_count: failedCashoutsCount,
      },
    });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
