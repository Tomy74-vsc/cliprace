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
    await requireAdminPermission('moderation.read');

    const admin = getAdminClient();
    const { data, error } = await admin
      .from('moderation_rule_versions')
      .select('id, rule_id, version, snapshot, created_by, created_at')
      .eq('rule_id', id)
      .order('version', { ascending: false })
      .limit(30);

    if (error) {
      if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
        return NextResponse.json({ items: [] });
      }
      throw createError('DATABASE_ERROR', 'Failed to load rule versions', 500, error.message);
    }

    return NextResponse.json({ items: data ?? [] });
  } catch (error) {
    return formatErrorResponse(error);
  }
}

