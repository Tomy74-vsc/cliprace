import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { assertCsrf } from '@/lib/csrf';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { enforceNotReadOnly } from '@/lib/admin/middleware-readonly';
import { brandValidators } from '@/lib/admin/validators';
import { createError, formatErrorResponse } from '@/lib/errors';
import type { ProfileInsert, ProfileBrandInsert } from '@/types/db';
import { env } from '@/lib/env';

const QuerySchema = z.object({
  q: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  page: z.coerce.number().min(1).default(1),
});

const CreateBrandSchema = z.object({
  email: z.string().email(),
  company_name: z.string().min(2).max(120),
  org_name: z.string().min(2).max(120).optional(),
  billing_email: z.string().email().optional(),
  send_invite: z.boolean().default(true),
});

export async function GET(req: NextRequest) {
  try {
    await requireAdminPermission('brands.read');
    const parsed = QuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
    const query = parsed.success ? parsed.data : QuerySchema.parse({});
    const limit = query.limit;
    const from = (query.page - 1) * limit;
    const to = from + limit - 1;

    const admin = getAdminClient();

    let profilesQuery = admin
      .from('profiles')
      .select('id, email, display_name, is_active, onboarding_complete, created_at, updated_at', {
        count: 'exact',
      })
      .eq('role', 'brand')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (query.status === 'active') profilesQuery = profilesQuery.eq('is_active', true);
    if (query.status === 'inactive') profilesQuery = profilesQuery.eq('is_active', false);

    if (query.q) {
      const q = `%${query.q}%`;
      const isUuid = /^[0-9a-fA-F-]{36}$/.test(query.q);
      const filters = [`email.ilike.${q}`, `display_name.ilike.${q}`];
      if (isUuid) filters.push(`id.eq.${query.q}`);
      profilesQuery = profilesQuery.or(filters.join(','));
    }

    const { data: profiles, error: profilesError, count } = await profilesQuery;
    if (profilesError) {
      throw createError('DATABASE_ERROR', 'Failed to load brands', 500, profilesError.message);
    }

    const brandIds = (profiles ?? []).map((row) => row.id);
    const [brandsRes, membershipsRes] = await Promise.all([
      brandIds.length
        ? admin.from('profile_brands').select('user_id, company_name').in('user_id', brandIds)
        : Promise.resolve({ data: [], error: null }),
      brandIds.length
        ? admin
            .from('org_members')
            .select('user_id, org_id, role_in_org, org:orgs(id, name, billing_email)')
            .in('user_id', brandIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (brandsRes.error) {
      throw createError('DATABASE_ERROR', 'Failed to load brand profiles', 500, brandsRes.error.message);
    }
    if (membershipsRes.error) {
      throw createError('DATABASE_ERROR', 'Failed to load org memberships', 500, membershipsRes.error.message);
    }

    const brandMap = new Map<string, { user_id: string; company_name: string }>(
      (brandsRes.data ?? []).map((row) => [row.user_id, row])
    );

    const membershipsByUser = new Map<
      string,
      Array<{
        org_id: string;
        role_in_org: string;
        org: { id: string; name: string | null; billing_email: string | null } | null;
      }>
    >();
    for (const row of membershipsRes.data ?? []) {
      const list = membershipsByUser.get(row.user_id) ?? [];
      const org = Array.isArray(row.org) ? row.org[0] ?? null : row.org ?? null;
      list.push({
        org_id: row.org_id,
        role_in_org: row.role_in_org,
        org,
      });
      membershipsByUser.set(row.user_id, list);
    }

    const items = (profiles ?? []).map((profile) => ({
      ...profile,
      brand: brandMap.get(profile.id) ?? null,
      org_memberships: membershipsByUser.get(profile.id) ?? [],
    }));

    return NextResponse.json({
      items,
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

export async function POST(req: NextRequest) {
  try {
    const { user: actor } = await requireAdminPermission('brands.write');
    await enforceNotReadOnly(req, actor.id);
    await enforceAdminRateLimit(req, { route: 'admin:brands:create', max: 10, windowMs: 60_000 }, actor.id);
    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch (csrfError) {
      throw createError('FORBIDDEN', 'Invalid CSRF token', 403, csrfError);
    }

    const json = await req.json();
    const parsed = CreateBrandSchema.safeParse(json);
    if (!parsed.success) {
      throw createError('VALIDATION_ERROR', 'Invalid payload', 400, parsed.error.flatten());
    }

    const email = parsed.data.email.trim().toLowerCase();
    
    // Validation métier
    const validation = await brandValidators.canCreate(email);
    if (!validation.valid) {
      throw createError(
        'VALIDATION_ERROR',
        'Cannot create brand',
        400,
        { errors: validation.errors }
      );
    }

    const admin = getAdminClient();
    const companyName = parsed.data.company_name.trim();
    const orgName = (parsed.data.org_name ?? companyName).trim();
    const billingEmail = (parsed.data.billing_email ?? email).trim().toLowerCase();

    let userId: string;
    let inviteSent = false;

    if (parsed.data.send_invite) {
      const siteUrl = env.NEXT_PUBLIC_SITE_URL || env.APP_URL || 'http://localhost:3000';
      const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { role: 'brand' },
        redirectTo: `${siteUrl}/auth/verify?email=${encodeURIComponent(email)}`,
      });
      if (inviteError || !inviteData.user) {
        const msg = inviteError?.message?.toLowerCase() || '';
        if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
          throw createError('CONFLICT', 'User already exists in Supabase Auth', 409, inviteError?.message);
        }
        throw createError('DATABASE_ERROR', 'Failed to invite user', 500, inviteError?.message);
      }
      userId = inviteData.user.id;
      inviteSent = true;
    } else {
      const { data: createData, error: createErrorRes } = await admin.auth.admin.createUser({
        email,
        email_confirm: false,
        user_metadata: { role: 'brand' },
      });
      if (createErrorRes || !createData.user) {
        const msg = createErrorRes?.message?.toLowerCase() || '';
        if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
          throw createError('CONFLICT', 'User already exists in Supabase Auth', 409, createErrorRes?.message);
        }
        throw createError('DATABASE_ERROR', 'Failed to create user', 500, createErrorRes?.message);
      }
      userId = createData.user.id;
    }

    const now = new Date().toISOString();

    const profileData: ProfileInsert = {
      id: userId,
      role: 'brand',
      email,
      display_name: companyName,
      is_active: true,
      onboarding_complete: false,
      created_at: now,
      updated_at: now,
    };

    const brandData: ProfileBrandInsert = {
      user_id: userId,
      company_name: companyName,
      created_at: now,
      updated_at: now,
    };

    const { error: profileInsertError } = await admin.from('profiles').insert(profileData);
    if (profileInsertError) {
      try {
        await admin.auth.admin.deleteUser(userId);
      } catch {}
      throw createError('DATABASE_ERROR', 'Failed to create profile', 500, profileInsertError.message);
    }

    const { error: brandInsertError } = await admin.from('profile_brands').insert(brandData);
    if (brandInsertError) {
      try {
        await admin.from('profiles').delete().eq('id', userId);
        await admin.auth.admin.deleteUser(userId);
      } catch {}
      throw createError('DATABASE_ERROR', 'Failed to create brand profile', 500, brandInsertError.message);
    }

    const { data: orgRow, error: orgError } = await admin
      .from('orgs')
      .insert({
        name: orgName,
        billing_email: billingEmail,
        created_at: now,
        updated_at: now,
      })
      .select('id, name, billing_email')
      .single();

    if (orgError || !orgRow) {
      try {
        await admin.from('profile_brands').delete().eq('user_id', userId);
        await admin.from('profiles').delete().eq('id', userId);
        await admin.auth.admin.deleteUser(userId);
      } catch {}
      throw createError('DATABASE_ERROR', 'Failed to create org', 500, orgError?.message);
    }

    const { error: memberError } = await admin.from('org_members').insert({
      org_id: orgRow.id,
      user_id: userId,
      role_in_org: 'owner',
      created_at: now,
    });

    if (memberError) {
      try {
        await admin.from('orgs').delete().eq('id', orgRow.id);
        await admin.from('profile_brands').delete().eq('user_id', userId);
        await admin.from('profiles').delete().eq('id', userId);
        await admin.auth.admin.deleteUser(userId);
      } catch {}
      throw createError('DATABASE_ERROR', 'Failed to create org membership', 500, memberError.message);
    }

    await admin.from('audit_logs').insert({
      actor_id: actor.id,
      action: 'admin_brand_create',
      table_name: 'profiles',
      row_pk: userId,
      new_values: {
        email,
        company_name: companyName,
        org_id: orgRow.id,
        org_name: orgRow.name,
        invite_sent: inviteSent,
      },
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    await admin.from('status_history').insert({
      table_name: 'profiles',
      row_id: userId,
      old_status: null,
      new_status: 'created',
      changed_by: actor.id,
      reason: 'admin_brand_create',
    });

    return NextResponse.json({
      ok: true,
      brand_id: userId,
      org_id: orgRow.id,
      invite_sent: inviteSent,
    });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
