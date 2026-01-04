import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { hasAdminPermission, requireAdminAnyPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { createError, formatErrorResponse } from '@/lib/errors';

const QuerySchema = z.object({
  q: z.string().min(1).max(120),
  limit: z.coerce.number().min(1).max(20).default(10),
});

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SearchItem = {
  type: 'user' | 'brand' | 'org' | 'contest' | 'submission';
  id: string;
  title: string;
  subtitle?: string | null;
  href: string;
};

export async function GET(req: NextRequest) {
  try {
    const { access } = await requireAdminAnyPermission([
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
    await enforceAdminRateLimit(req, { route: 'admin:search', max: 120, windowMs: 60_000 });

    const parsed = QuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
    if (!parsed.success) {
      throw createError('VALIDATION_ERROR', 'Paramètres invalides', 400, parsed.error.flatten());
    }

    const admin = getAdminClient();
    const q = parsed.data.q.trim();
    const like = `%${q}%`;
    const limit = parsed.data.limit;
    const qIsUuid = uuidPattern.test(q);

    const results: SearchItem[] = [];

    const canUsers = hasAdminPermission(access, 'users.read');
    const canBrands = hasAdminPermission(access, 'brands.read');
    const canContests = hasAdminPermission(access, 'contests.read');
    const canSubmissions = hasAdminPermission(access, 'submissions.read');
    const canOrgs = [
      'invoices.read',
      'finance.read',
      'integrations.read',
      'brands.read',
      'support.read',
      'crm.read',
      'audit.read',
    ].some((permission) => hasAdminPermission(access, permission));

    const empty = Promise.resolve({ data: [], error: null } as any);

    const [
      usersRes,
      brandsRes,
      orgsRes,
      contestsRes,
      submissionsRes,
    ] = await Promise.all([
      canUsers
        ? admin
            .from('profiles')
            .select('id, email, display_name, role')
            .or(`email.ilike.${like},display_name.ilike.${like}`)
            .limit(limit)
        : empty,
      canBrands
        ? admin
            .from('profile_brands')
            .select('user_id, company_name, profiles!inner(id, email, display_name)')
            .ilike('company_name', like)
            .limit(limit)
        : empty,
      canOrgs
        ? admin
            .from('orgs')
            .select('id, name, billing_email')
            .or(`name.ilike.${like},billing_email.ilike.${like}`)
            .limit(limit)
        : empty,
      canContests
        ? admin
            .from('contests')
            .select('id, title, slug, status, brand_id')
            .or(`title.ilike.${like},slug.ilike.${like}`)
            .order('created_at', { ascending: false })
            .limit(limit)
        : empty,
      canSubmissions
        ? (() => {
            let s = admin
              .from('submissions')
              .select('id, contest_id, creator_id, status, created_at')
              .order('created_at', { ascending: false })
              .limit(limit);
            if (qIsUuid) {
              s = s.or(`id.eq.${q},contest_id.eq.${q},creator_id.eq.${q}`);
            }
            return s;
          })()
        : empty,
    ]);

    if (canUsers && usersRes.error) {
      throw createError('DATABASE_ERROR', 'Recherche utilisateurs impossible', 500, usersRes.error.message);
    }
    if (canBrands && brandsRes.error) {
      throw createError('DATABASE_ERROR', 'Recherche marques impossible', 500, brandsRes.error.message);
    }
    if (canOrgs && orgsRes.error) {
      throw createError('DATABASE_ERROR', 'Recherche organisations impossible', 500, orgsRes.error.message);
    }
    if (canContests && contestsRes.error) {
      throw createError('DATABASE_ERROR', 'Recherche concours impossible', 500, contestsRes.error.message);
    }
    if (canSubmissions && submissionsRes.error) {
      throw createError('DATABASE_ERROR', 'Recherche soumissions impossible', 500, submissionsRes.error.message);
    }

    for (const row of (canUsers ? usersRes.data ?? [] : [])) {
      results.push({
        type: 'user',
        id: row.id,
        title: row.display_name || row.email,
        subtitle: `${row.email} • ${row.role}`,
        href: `/app/admin/users/${row.id}`,
      });
    }

    for (const row of (canBrands ? brandsRes.data ?? [] : [])) {
      const profile = Array.isArray((row as any).profiles) ? (row as any).profiles[0] : (row as any).profiles;
      const title = row.company_name || profile?.display_name || profile?.email || row.user_id;
      results.push({
        type: 'brand',
        id: row.user_id,
        title,
        subtitle: profile?.email ?? null,
        href: `/app/admin/brands?q=${encodeURIComponent(title)}`,
      });
    }

    for (const row of (canOrgs ? orgsRes.data ?? [] : [])) {
      results.push({
        type: 'org',
        id: row.id,
        title: row.name || row.id,
        subtitle: row.billing_email,
        href: `/app/admin/invoices?org_id=${encodeURIComponent(row.id)}`,
      });
    }

    for (const row of (canContests ? contestsRes.data ?? [] : [])) {
      results.push({
        type: 'contest',
        id: row.id,
        title: row.title,
        subtitle: `${row.status} • ${row.slug ?? ''}`.trim(),
        href: `/app/admin/contests?q=${encodeURIComponent(row.title)}`,
      });
    }

    for (const row of (canSubmissions ? submissionsRes.data ?? [] : [])) {
      results.push({
        type: 'submission',
        id: row.id,
        title: `Soumission ${row.id.slice(0, 8)}`,
        subtitle: `${row.status} • concours ${row.contest_id.slice(0, 8)}`,
        href: `/app/admin/submissions?submission_id=${encodeURIComponent(row.id)}`,
      });
    }

    return NextResponse.json({ ok: true, items: results.slice(0, limit) });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
