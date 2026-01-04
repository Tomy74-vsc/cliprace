import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { createError, formatErrorResponse } from '@/lib/errors';

const booleanParam = z.preprocess((value) => {
  if (value === '' || value === undefined) return undefined;
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
}, z.boolean().optional());

const QuerySchema = z.object({
  is_active: booleanParam,
  q: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
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
    let tagsQuery = admin
      .from('contest_tags')
      .select('id, name, slug, description, color, icon_url, is_active, created_at, updated_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (typeof query.is_active === 'boolean') tagsQuery = tagsQuery.eq('is_active', query.is_active);
    if (query.q) {
      const like = `%${query.q.trim()}%`;
      tagsQuery = tagsQuery.or(`name.ilike.${like},slug.ilike.${like},description.ilike.${like}`);
    }

    const { data: items, error, count } = await tagsQuery;
    if (error) {
      throw createError('DATABASE_ERROR', 'Failed to load contest tags', 500, error.message);
    }

    return NextResponse.json({
      items: items ?? [],
      pagination: { total: count ?? 0, page: query.page, limit },
    });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
