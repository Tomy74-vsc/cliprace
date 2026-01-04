import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { createError, formatErrorResponse } from '@/lib/errors';

const QuerySchema = z.object({
  bucket: z.string().optional(),
  visibility: z.enum(['private', 'public']).optional(),
  moderation_status: z.enum(['pending', 'approved', 'rejected']).optional(),
  owner_id: z.string().uuid().optional(),
  org_id: z.string().uuid().optional(),
  q: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  page: z.coerce.number().min(1).default(1),
});

export async function GET(req: NextRequest) {
  try {
    await requireAdminPermission('taxonomy.read');
    const parsed = QuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
    const query = parsed.success ? parsed.data : QuerySchema.parse({});
    const limit = query.limit;
    const from = (query.page - 1) * limit;
    const to = from + limit - 1;

    const admin = getAdminClient();
    let assetsQuery = admin
      .from('assets')
      .select(
        'id, owner_id, org_id, bucket, path, mime_type, size_bytes, sha256, visibility, moderation_status, created_at, updated_at, owner:profiles(id, display_name, email), org:orgs(id, name)',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    if (query.bucket) assetsQuery = assetsQuery.eq('bucket', query.bucket);
    if (query.visibility) assetsQuery = assetsQuery.eq('visibility', query.visibility);
    if (query.moderation_status) assetsQuery = assetsQuery.eq('moderation_status', query.moderation_status);
    if (query.owner_id) assetsQuery = assetsQuery.eq('owner_id', query.owner_id);
    if (query.org_id) assetsQuery = assetsQuery.eq('org_id', query.org_id);
    if (query.q) {
      const like = `%${query.q.trim()}%`;
      assetsQuery = assetsQuery.or(`path.ilike.${like},bucket.ilike.${like},mime_type.ilike.${like}`);
    }

    const { data: items, error, count } = await assetsQuery;
    if (error) {
      throw createError('DATABASE_ERROR', 'Failed to load assets', 500, error.message);
    }

    return NextResponse.json({
      items: items ?? [],
      pagination: { total: count ?? 0, page: query.page, limit },
    });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
