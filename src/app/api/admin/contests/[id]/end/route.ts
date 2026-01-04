import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { assertCsrf } from '@/lib/csrf';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { createError, formatErrorResponse } from '@/lib/errors';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { user } = await requireAdminPermission('contests.write');
    await enforceAdminRateLimit(req, { route: 'admin:contests:end', max: 10, windowMs: 60_000 });
    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch (csrfError) {
      throw createError('FORBIDDEN', 'Invalid CSRF token', 403, csrfError);
    }

    const admin = getAdminClient();
    const { data: contest, error: contestError } = await admin
      .from('contests')
      .select('id, status')
      .eq('id', id)
      .single();

    if (contestError || !contest) {
      throw createError('NOT_FOUND', 'Contest not found', 404, contestError?.message);
    }

    if (contest.status !== 'active') {
      throw createError(
        'CONFLICT',
        `Contest cannot be ended from status ${contest.status}`,
        409
      );
    }

    const { error: finalizeError } = await admin.rpc('finalize_contest', {
      p_contest_id: id,
    });
    if (finalizeError) {
      throw createError('DATABASE_ERROR', 'Contest finalize failed', 500, finalizeError.message);
    }

    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'contest_end',
      table_name: 'contests',
      row_pk: id,
      old_values: { status: contest.status },
      new_values: { status: 'ended' },
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({ ok: true, old_status: contest.status, new_status: 'ended' });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
