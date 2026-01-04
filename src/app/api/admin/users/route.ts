import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { createError, formatErrorResponse } from '@/lib/errors';

const QuerySchema = z.object({
  role: z.string().optional(),
  status: z.string().optional(),
  q: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  page: z.coerce.number().min(1).default(1),
});

export async function GET(req: NextRequest) {
  try {
    await requireAdminPermission('users.read');
    const parsed = QuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
    const query = parsed.success ? parsed.data : QuerySchema.parse({});
    const limit = query.limit;
    const from = (query.page - 1) * limit;
    const to = from + limit - 1;

    const admin = getAdminClient();
    let usersQuery = admin
      .from('profiles')
      .select(
        'id, email, display_name, role, is_active, onboarding_complete, created_at, updated_at',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    if (query.role) {
      usersQuery = usersQuery.eq('role', query.role);
    }

    if (query.status === 'active') {
      usersQuery = usersQuery.eq('is_active', true);
    }
    if (query.status === 'inactive') {
      usersQuery = usersQuery.eq('is_active', false);
    }

    if (query.q) {
      const q = `%${query.q}%`;
      const isUuid = /^[0-9a-fA-F-]{36}$/.test(query.q);
      const filters = [`email.ilike.${q}`, `display_name.ilike.${q}`];
      if (isUuid) {
        filters.push(`id.eq.${query.q}`);
      }
      usersQuery = usersQuery.or(filters.join(','));
    }

    const { data, error, count } = await usersQuery;
    if (error) {
      throw createError('DATABASE_ERROR', 'Failed to load users', 500, error.message);
    }

    return NextResponse.json({
      items: data ?? [],
      pagination: {
        total: count ?? 0,
        page: query.page,
        limit,
      },
    });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
