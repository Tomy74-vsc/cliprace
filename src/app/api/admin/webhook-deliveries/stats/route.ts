import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { createError, formatErrorResponse } from '@/lib/errors';

export async function GET(req: NextRequest) {
  try {
    await requireAdminPermission('integrations.read');
    const range = req.nextUrl.searchParams.get('range') || '24h';
    const hours = range === '1h' ? 1 : range === '7d' ? 24 * 7 : 24;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const admin = getAdminClient();
    const { data, error } = await admin
      .from('webhook_deliveries')
      .select('id, endpoint_id, last_error, created_at')
      .eq('status', 'failed')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(2000);

    if (error) {
      throw createError('DATABASE_ERROR', 'Failed to load webhook delivery stats', 500, error.message);
    }

    const counts = new Map<string, number>();
    for (const row of data ?? []) {
      const errKey = (row as any).last_error ? String((row as any).last_error).slice(0, 180) : 'Erreur inconnue';
      counts.set(errKey, (counts.get(errKey) ?? 0) + 1);
    }

    const top = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([error, count]) => ({ error, count }));

    return NextResponse.json({ range, since, top, total_failed: (data ?? []).length });
  } catch (error) {
    return formatErrorResponse(error);
  }
}

