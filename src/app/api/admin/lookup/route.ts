import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { hasAdminPermission, requireAdminAnyPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { adminCache, cacheKey, CACHE_TTL } from '@/lib/admin/cache';
import { createError, formatErrorResponse } from '@/lib/errors';

const QuerySchema = z.object({
  kind: z.enum(['user', 'brand', 'org', 'contest']),
  q: z.string().max(120).optional(),
  id: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(20).default(10),
});

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type LookupItem = { id: string; label: string; subtitle?: string | null };

export async function GET(req: NextRequest) {
  try {
    const { access, user } = await requireAdminAnyPermission([
      'users.read',
      'brands.read',
      'contests.read',
      'submissions.read',
      'invoices.read',
      'finance.read',
      'integrations.read',
      'support.read',
      'crm.read',
      'taxonomy.read',
      'risk.read',
      'ingestion.read',
      'emails.read',
      'audit.read',
    ]);
    await enforceAdminRateLimit(req, { route: 'admin:lookup', max: 240, windowMs: 60_000 }, user.id);

    const parsed = QuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
    if (!parsed.success) {
      throw createError('VALIDATION_ERROR', 'Paramètres invalides', 400, parsed.error.flatten());
    }

    const admin = getAdminClient();
    const { kind, q, id, limit } = parsed.data;

    const canLookup =
      kind === 'user'
        ? hasAdminPermission(access, 'users.read')
        : kind === 'brand'
          ? hasAdminPermission(access, 'brands.read')
          : kind === 'contest'
            ? hasAdminPermission(access, 'contests.read')
            : [
                'invoices.read',
                'finance.read',
                'integrations.read',
                'brands.read',
                'support.read',
                'crm.read',
                'audit.read',
              ].some((permission) => hasAdminPermission(access, permission));

    if (!canLookup) {
      throw createError('FORBIDDEN', 'Accès refusé', 403, { kind });
    }

    const term = (q ?? '').trim();
    const like = `%${term}%`;
    const termIsUuid = uuidPattern.test(term);

    const key = cacheKey('admin:lookup', {
      user_id: user.id,
      kind,
      q: term || '',
      id: id || '',
      limit,
    });

    const items = await adminCache.getOrSet<LookupItem[]>(
      key,
      async () => {
        const out: LookupItem[] = [];

        if (kind === 'user') {
          let query = admin.from('profiles').select('id, email, display_name, role').limit(limit);
          if (id) query = query.eq('id', id);
          if (term) query = termIsUuid ? query.eq('id', term) : query.or(`email.ilike.${like},display_name.ilike.${like}`);
          const { data, error } = await query;
          if (error) throw createError('DATABASE_ERROR', 'Lookup utilisateurs impossible', 500, error.message);
          for (const row of data ?? []) {
            out.push({
              id: row.id,
              label: row.display_name || row.email,
              subtitle: `${row.email} • ${row.role}`,
            });
          }
        }

        if (kind === 'brand') {
          let query = admin
            .from('profiles')
            .select('id, email, display_name, role, brand:profile_brands(company_name)')
            .eq('role', 'brand')
            .limit(limit);
          if (id) query = query.eq('id', id);
          if (term) query = query.or(`email.ilike.${like},display_name.ilike.${like}`);
          const { data, error } = await query;
          if (error) throw createError('DATABASE_ERROR', 'Lookup marques impossible', 500, error.message);
          for (const row of data ?? []) {
            const brand = Array.isArray((row as UnsafeAny).brand) ? (row as UnsafeAny).brand[0] : (row as UnsafeAny).brand;
            const companyName = brand?.company_name ?? null;
            out.push({
              id: row.id,
              label: companyName || row.display_name || row.email,
              subtitle: row.email,
            });
          }
        }

        if (kind === 'org') {
          let query = admin.from('orgs').select('id, name, billing_email').limit(limit);
          if (id) query = query.eq('id', id);
          if (term) query = termIsUuid ? query.eq('id', term) : query.or(`name.ilike.${like},billing_email.ilike.${like}`);
          const { data, error } = await query;
          if (error) throw createError('DATABASE_ERROR', 'Lookup organisations impossible', 500, error.message);
          for (const row of data ?? []) {
            out.push({ id: row.id, label: row.name || row.id, subtitle: row.billing_email });
          }
        }

        if (kind === 'contest') {
          let query = admin.from('contests').select('id, title, slug, status').limit(limit);
          if (id) query = query.eq('id', id);
          if (term) query = termIsUuid ? query.eq('id', term) : query.or(`title.ilike.${like},slug.ilike.${like}`);
          const { data, error } = await query;
          if (error) throw createError('DATABASE_ERROR', 'Lookup concours impossible', 500, error.message);
          for (const row of data ?? []) {
            out.push({
              id: row.id,
              label: row.title,
              subtitle: `${row.status}${row.slug ? ` • ${row.slug}` : ''}`,
            });
          }
        }

        return out;
      },
      CACHE_TTL.SHORT
    );

    return NextResponse.json({ ok: true, items });
  } catch (error) {
    return formatErrorResponse(error);
  }
}

