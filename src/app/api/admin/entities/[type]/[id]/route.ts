import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAnyPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { createError, formatErrorResponse } from '@/lib/errors';
import { formatCurrency, formatDateTime } from '@/lib/formatters';

type EntityType = 'user' | 'contest' | 'submission' | 'cashout';

async function loadTimelineAndAudit(admin: UnsafeAny, tableName: string, rowId: string) {
  // Timeline
  const { data: timeline } = await admin
    .from('status_history')
    .select('created_at, old_status, new_status, reason, changed_by')
    .eq('table_name', tableName)
    .eq('row_id', rowId)
    .order('created_at', { ascending: false })
    .limit(20);

  const timelineActorIds = [...new Set((timeline || []).map((t: UnsafeAny) => t.changed_by).filter(Boolean))];
  const timelineActors = timelineActorIds.length > 0
    ? await admin.from('profiles').select('id, display_name, email').in('id', timelineActorIds)
    : { data: [] };
  const actorsMap = new Map(
    (timelineActors.data || []).map((a: UnsafeAny) => [a.id, a.display_name || a.email || a.id])
  );

  // Audit
  const { data: audit } = await admin
    .from('audit_logs')
    .select('created_at, action, actor_id, new_values')
    .eq('table_name', tableName)
    .eq('row_pk', rowId)
    .order('created_at', { ascending: false })
    .limit(20);

  const auditActorIds = [...new Set((audit || []).map((a: UnsafeAny) => a.actor_id).filter(Boolean))];
  const auditActors = auditActorIds.length > 0
    ? await admin.from('profiles').select('id, display_name, email').in('id', auditActorIds)
    : { data: [] };
  const auditActorsMap = new Map(
    (auditActors.data || []).map((a: UnsafeAny) => [a.id, a.display_name || a.email || a.id])
  );

  return {
    timeline: (timeline || []).map((t: UnsafeAny) => ({
      date: t.created_at,
      status: `${t.old_status} → ${t.new_status}`,
      reason: t.reason || undefined,
      changed_by: t.changed_by ? actorsMap.get(t.changed_by) : undefined,
    })),
    audit: (audit || []).map((a: UnsafeAny) => ({
      date: a.created_at,
      action: a.action,
      actor: a.actor_id ? auditActorsMap.get(a.actor_id) : undefined,
      details: a.new_values,
    })),
  };
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ type: string; id: string }> }
) {
  try {
    const { type, id } = await context.params;
    const entityType = type as EntityType;

    // Vérifier les permissions selon le type
    const permissions: Record<EntityType, string[]> = {
      user: ['users.read'],
      contest: ['contests.read'],
      submission: ['submissions.read'],
      cashout: ['finance.read'],
    };

    await requireAdminAnyPermission(permissions[entityType] || ['dashboard.read']);

    const admin = getAdminClient();

    if (entityType === 'user') {
      const { data: profile, error: profileError } = await admin
        .from('profiles')
        .select('id, email, display_name, role, is_active, created_at, updated_at')
        .eq('id', id)
        .single();

      if (profileError || !profile) {
        throw createError('NOT_FOUND', 'User not found', 404);
      }

      const { timeline, audit } = await loadTimelineAndAudit(admin, 'profiles', id);

      return NextResponse.json({
        type: 'user',
        id: profile.id,
        label: profile.display_name || profile.email,
        subtitle: profile.email,
        overview: {
          role: profile.role,
          is_active: profile.is_active,
          created_at: formatDateTime(profile.created_at),
          updated_at: formatDateTime(profile.updated_at),
        },
        timeline,
        audit,
      });
    }

    if (entityType === 'contest') {
      const { data: contest, error: contestError } = await admin
        .from('contests')
        .select('id, title, slug, status, prize_pool_cents, start_at, end_at, created_at, updated_at')
        .eq('id', id)
        .single();

      if (contestError || !contest) {
        throw createError('NOT_FOUND', 'Contest not found', 404);
      }

      const { timeline, audit } = await loadTimelineAndAudit(admin, 'contests', id);

      return NextResponse.json({
        type: 'contest',
        id: contest.id,
        label: contest.title || contest.slug,
        subtitle: contest.slug,
        overview: {
          status: contest.status,
          prize_pool: formatCurrency(contest.prize_pool_cents, 'EUR'),
          start_at: formatDateTime(contest.start_at),
          end_at: formatDateTime(contest.end_at),
          created_at: formatDateTime(contest.created_at),
        },
        timeline,
        audit,
      });
    }

    if (entityType === 'submission') {
      const { data: submission, error: submissionError } = await admin
        .from('submissions')
        .select('id, title, status, platform, external_url, submitted_at, approved_at, created_at')
        .eq('id', id)
        .single();

      if (submissionError || !submission) {
        throw createError('NOT_FOUND', 'Submission not found', 404);
      }

      const { timeline, audit } = await loadTimelineAndAudit(admin, 'submissions', id);

      return NextResponse.json({
        type: 'submission',
        id: submission.id,
        label: submission.title || submission.id,
        subtitle: submission.platform,
        overview: {
          status: submission.status,
          platform: submission.platform,
          external_url: submission.external_url,
          submitted_at: formatDateTime(submission.submitted_at),
          approved_at: submission.approved_at ? formatDateTime(submission.approved_at) : null,
        },
        timeline,
        audit,
      });
    }

    if (entityType === 'cashout') {
      const { data: cashout, error: cashoutError } = await admin
        .from('cashouts')
        .select('id, amount_cents, status, requested_at, processed_at, created_at')
        .eq('id', id)
        .single();

      if (cashoutError || !cashout) {
        throw createError('NOT_FOUND', 'Cashout not found', 404);
      }

      const { timeline, audit } = await loadTimelineAndAudit(admin, 'cashouts', id);

      return NextResponse.json({
        type: 'cashout',
        id: cashout.id,
        label: `Cashout ${formatCurrency(cashout.amount_cents, 'EUR')}`,
        subtitle: cashout.status,
        overview: {
          amount: formatCurrency(cashout.amount_cents, 'EUR'),
          status: cashout.status,
          requested_at: formatDateTime(cashout.requested_at),
          processed_at: cashout.processed_at ? formatDateTime(cashout.processed_at) : null,
        },
        timeline,
        audit,
      });
    }

    throw createError('VALIDATION_ERROR', 'Invalid entity type', 400, { type: entityType });
  } catch (error) {
    return formatErrorResponse(error);
  }
}

