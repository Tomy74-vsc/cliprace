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
    await requireAdminPermission('ingestion.write');
    await enforceAdminRateLimit(req, { route: 'admin:ingestion:jobs:rerun', max: 60, windowMs: 60_000 });

    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch (csrfError) {
      throw createError('FORBIDDEN', 'Invalid CSRF token', 403, csrfError);
    }

    const jobId = Number(id);
    if (!Number.isFinite(jobId)) {
      throw createError('VALIDATION_ERROR', 'Invalid id', 400);
    }

    const admin = getAdminClient();
    const { data: current, error: loadError } = await admin
      .from('ingestion_jobs')
      .select('id, status')
      .eq('id', jobId)
      .single();

    if (loadError) {
      throw createError('DATABASE_ERROR', 'Failed to load ingestion job', 500, loadError.message);
    }

    if (!current) {
      throw createError('NOT_FOUND', 'Job not found', 404);
    }

    const { data, error } = await admin
      .from('ingestion_jobs')
      .update({
        status: 'queued',
        scheduled_at: new Date().toISOString(),
        last_error: null,
      })
      .eq('id', jobId)
      .select('id, status, scheduled_at, updated_at')
      .single();

    if (error) {
      throw createError('DATABASE_ERROR', 'Failed to rerun ingestion job', 500, error.message);
    }

    return NextResponse.json({ item: data });
  } catch (error) {
    return formatErrorResponse(error);
  }
}

