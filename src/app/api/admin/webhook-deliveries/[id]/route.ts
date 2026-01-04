import { NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { createError, formatErrorResponse } from '@/lib/errors';

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    await requireAdminPermission('integrations.read');

    const admin = getAdminClient();
    const { data, error } = await admin
      .from('webhook_deliveries')
      .select(
        'id, endpoint_id, event, status, retry_count, last_error, created_at, updated_at, payload, endpoint:webhook_endpoints(id, org_id, endpoint_url, active, org:orgs(id, name, billing_email))'
      )
      .eq('id', Number(id))
      .single();

    if (error) {
      throw createError('DATABASE_ERROR', 'Failed to load webhook delivery', 500, error.message);
    }

    return NextResponse.json({ item: data });
  } catch (error) {
    return formatErrorResponse(error);
  }
}

