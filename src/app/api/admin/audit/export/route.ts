import { NextRequest } from 'next/server';
import { z } from 'zod';
import { hasAdminPermission, requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { createError, formatErrorResponse } from '@/lib/errors';

const booleanParam = z.preprocess((value) => {
  if (value === '' || value === undefined) return undefined;
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
}, z.boolean().optional());

const ExportSchema = z.object({
  type: z.enum(['audit_logs', 'status_history', 'event_log', 'webhooks_stripe']),
  limit: z.coerce.number().min(1).max(5000).default(1000),
  q: z.string().optional(),
  table_name: z.string().optional(),
  action: z.string().optional(),
  actor_id: z.string().uuid().optional(),
  row_pk: z.string().uuid().optional(),
  row_id: z.string().uuid().optional(),
  changed_by: z.string().uuid().optional(),
  new_status: z.string().optional(),
  event_name: z.string().optional(),
  user_id: z.string().uuid().optional(),
  org_id: z.string().uuid().optional(),
  event_type: z.string().optional(),
  processed: booleanParam,
});

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function escapeCsv(value: unknown) {
  if (value === null || value === undefined) return '';
  const raw = typeof value === 'string' ? value : JSON.stringify(value);
  const needsQuotes = raw.includes(',') || raw.includes('"') || raw.includes('\n') || raw.includes('\r');
  const escaped = raw.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

function toCsv(headers: string[], rows: Array<Array<unknown>>) {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeCsv).join(','));
  }
  return lines.join('\n');
}

export async function GET(req: NextRequest) {
  try {
    const { access } = await requireAdminPermission('audit.read');
    if (!hasAdminPermission(access, 'exports.write')) {
      throw createError('FORBIDDEN', 'Accès refusé', 403, { permission: 'exports.write' });
    }
    const parsed = ExportSchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
    const query = parsed.success ? parsed.data : ExportSchema.parse({ type: 'audit_logs' });

    const admin = getAdminClient();
    const limit = query.limit;

    if (query.type === 'audit_logs') {
      let auditQuery = admin
        .from('audit_logs')
        .select(
          'id, actor_id, action, table_name, row_pk, old_values, new_values, ip, user_agent, created_at, actor:profiles(id, email)'
        )
        .order('created_at', { ascending: false })
        .limit(limit);

      if (query.table_name) auditQuery = auditQuery.eq('table_name', query.table_name);
      if (query.action) auditQuery = auditQuery.eq('action', query.action);
      if (query.actor_id) auditQuery = auditQuery.eq('actor_id', query.actor_id);
      if (query.row_pk) auditQuery = auditQuery.eq('row_pk', query.row_pk);
      if (query.q) {
        const trimmed = query.q.trim();
        if (uuidPattern.test(trimmed)) {
          auditQuery = auditQuery.eq('row_pk', trimmed);
        } else {
          const like = `%${trimmed}%`;
          auditQuery = auditQuery.or(`action.ilike.${like},table_name.ilike.${like}`);
        }
      }

      const { data: rows, error } = await auditQuery;
      if (error) throw createError('DATABASE_ERROR', 'Failed to export audit logs', 500, error.message);

      const headers = [
        'id',
        'created_at',
        'actor_id',
        'actor_email',
        'action',
        'table_name',
        'row_pk',
        'old_values',
        'new_values',
        'ip',
        'user_agent',
      ];
      const csv = toCsv(
        headers,
        (rows ?? []).map((row) => [
          row.id,
          row.created_at,
          row.actor_id,
          (Array.isArray((row as any).actor) ? (row as any).actor[0]?.email : (row as any).actor?.email) ??
            '',
          row.action,
          row.table_name,
          row.row_pk,
          row.old_values,
          row.new_values,
          row.ip,
          row.user_agent,
        ])
      );

      return new Response(csv, {
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': 'attachment; filename="audit_logs.csv"',
        },
      });
    }

    if (query.type === 'status_history') {
      let historyQuery = admin
        .from('status_history')
        .select(
          'id, table_name, row_id, old_status, new_status, changed_by, reason, metadata, created_at, actor:profiles(id, email)'
        )
        .order('created_at', { ascending: false })
        .limit(limit);

      if (query.table_name) historyQuery = historyQuery.eq('table_name', query.table_name);
      if (query.new_status) historyQuery = historyQuery.eq('new_status', query.new_status);
      if (query.changed_by) historyQuery = historyQuery.eq('changed_by', query.changed_by);
      if (query.row_id) historyQuery = historyQuery.eq('row_id', query.row_id);
      if (query.q) {
        const trimmed = query.q.trim();
        if (uuidPattern.test(trimmed)) {
          historyQuery = historyQuery.eq('row_id', trimmed);
        } else {
          const like = `%${trimmed}%`;
          historyQuery = historyQuery.or(`table_name.ilike.${like},new_status.ilike.${like},reason.ilike.${like}`);
        }
      }

      const { data: rows, error } = await historyQuery;
      if (error) throw createError('DATABASE_ERROR', 'Failed to export status history', 500, error.message);

      const headers = [
        'id',
        'created_at',
        'table_name',
        'row_id',
        'old_status',
        'new_status',
        'changed_by',
        'changed_by_email',
        'reason',
        'metadata',
      ];
      const csv = toCsv(
        headers,
        (rows ?? []).map((row) => [
          row.id,
          row.created_at,
          row.table_name,
          row.row_id,
          row.old_status,
          row.new_status,
          row.changed_by,
          (Array.isArray((row as any).actor) ? (row as any).actor[0]?.email : (row as any).actor?.email) ??
            '',
          row.reason,
          row.metadata,
        ])
      );

      return new Response(csv, {
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': 'attachment; filename="status_history.csv"',
        },
      });
    }

    if (query.type === 'event_log') {
      let eventQuery = admin
        .from('event_log')
        .select(
          'id, user_id, org_id, event_name, properties, created_at, user:profiles(id, email), org:orgs(id, name)'
        )
        .order('created_at', { ascending: false })
        .limit(limit);

      if (query.event_name) eventQuery = eventQuery.eq('event_name', query.event_name);
      if (query.user_id) eventQuery = eventQuery.eq('user_id', query.user_id);
      if (query.org_id) eventQuery = eventQuery.eq('org_id', query.org_id);
      if (query.q) {
        const trimmed = query.q.trim();
        if (uuidPattern.test(trimmed)) {
          eventQuery = eventQuery.or(`user_id.eq.${trimmed},org_id.eq.${trimmed}`);
        } else {
          const like = `%${trimmed}%`;
          eventQuery = eventQuery.ilike('event_name', like);
        }
      }

      const { data: rows, error } = await eventQuery;
      if (error) throw createError('DATABASE_ERROR', 'Failed to export event log', 500, error.message);

      const headers = [
        'id',
        'created_at',
        'event_name',
        'user_id',
        'user_email',
        'org_id',
        'org_name',
        'properties',
      ];
      const csv = toCsv(
        headers,
        (rows ?? []).map((row) => [
          row.id,
          row.created_at,
          row.event_name,
          row.user_id,
          (Array.isArray((row as any).user) ? (row as any).user[0]?.email : (row as any).user?.email) ??
            '',
          row.org_id,
          (Array.isArray((row as any).org) ? (row as any).org[0]?.name : (row as any).org?.name) ??
            '',
          row.properties,
        ])
      );

      return new Response(csv, {
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': 'attachment; filename="event_log.csv"',
        },
      });
    }

    let webhooksQuery = admin
      .from('webhooks_stripe')
      .select('id, stripe_event_id, event_type, processed, processed_at, created_at, payload')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (query.event_type) webhooksQuery = webhooksQuery.eq('event_type', query.event_type);
    if (typeof query.processed === 'boolean') webhooksQuery = webhooksQuery.eq('processed', query.processed);
    if (query.q) {
      const like = `%${query.q.trim()}%`;
      webhooksQuery = webhooksQuery.or(`stripe_event_id.ilike.${like},event_type.ilike.${like}`);
    }

    const { data: rows, error } = await webhooksQuery;
    if (error) throw createError('DATABASE_ERROR', 'Failed to export Stripe webhooks', 500, error.message);

    const headers = [
      'id',
      'created_at',
      'stripe_event_id',
      'event_type',
      'processed',
      'processed_at',
      'payload',
    ];
    const csv = toCsv(
      headers,
      (rows ?? []).map((row) => [
        row.id,
        row.created_at,
        row.stripe_event_id,
        row.event_type,
        row.processed,
        row.processed_at,
        row.payload,
      ])
    );

    return new Response(csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': 'attachment; filename="webhooks_stripe.csv"',
      },
    });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
