import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { createError, formatErrorResponse } from '@/lib/errors';

const QuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
});

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    await requireAdminPermission('tasks.read');
    await enforceAdminRateLimit(req, { route: 'admin:tasks:events', max: 120, windowMs: 60_000 });

    const parsed = QuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
    const query = parsed.success ? parsed.data : QuerySchema.parse({});

    const admin = getAdminClient();
    const { data: events, error } = await admin
      .from('admin_task_events')
      .select(
        'id, event_type, message, from_status, to_status, from_assigned_to, to_assigned_to, created_by, created_at, actor:profiles(id, display_name, email)'
      )
      .eq('task_id', id)
      .order('created_at', { ascending: false })
      .limit(query.limit);

    if (error) throw createError('DATABASE_ERROR', 'Failed to load task events', 500, error.message);
    return NextResponse.json({ items: events ?? [] });
  } catch (error) {
    return formatErrorResponse(error);
  }
}

