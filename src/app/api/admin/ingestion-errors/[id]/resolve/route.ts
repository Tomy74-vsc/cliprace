import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { assertCsrf } from '@/lib/csrf';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { createError, formatErrorResponse } from '@/lib/errors';

const BodySchema = z.object({
  resolved: z.boolean().optional(),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    await requireAdminPermission('ingestion.write');
    await enforceAdminRateLimit(req, { route: 'admin:ingestion:errors:resolve', max: 60, windowMs: 60_000 });

    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch (csrfError) {
      throw createError('FORBIDDEN', 'Invalid CSRF token', 403, csrfError);
    }

    const errorId = Number(id);
    if (!Number.isFinite(errorId)) {
      throw createError('VALIDATION_ERROR', 'Invalid id', 400);
    }

    const body = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(body);
    const resolved = parsed.success ? (parsed.data.resolved ?? true) : true;

    const admin = getAdminClient();
    const { data, error } = await admin
      .from('ingestion_errors')
      .update(
        resolved
          ? { is_resolved: true, resolved_at: new Date().toISOString(), resolved_by: null }
          : { is_resolved: false, resolved_at: null, resolved_by: null }
      )
      .eq('id', errorId)
      .select('id, is_resolved, resolved_at')
      .single();

    if (error) {
      if (error.message?.includes('column \"is_resolved\"')) {
        throw createError('DATABASE_ERROR', 'Migration requise: db_refonte/46_ingestion_errors_resolution.sql', 500, error.message);
      }
      throw createError('DATABASE_ERROR', 'Failed to update ingestion error', 500, error.message);
    }

    return NextResponse.json({ item: data });
  } catch (error) {
    return formatErrorResponse(error);
  }
}

