import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { assertCsrf } from '@/lib/csrf';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { createError, formatErrorResponse } from '@/lib/errors';

const UpdateSchema = z.object({
  role: z.enum(['admin', 'brand', 'creator']).optional(),
  is_active: z.boolean().optional(),
});

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminPermission('users.read');
    const { id } = await context.params;
    const admin = getAdminClient();

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select(
        'id, email, display_name, role, avatar_url, bio, country, is_active, onboarding_complete, created_at, updated_at'
      )
      .eq('id', id)
      .single();

    if (profileError || !profile) {
      throw createError('NOT_FOUND', 'User not found', 404, profileError?.message);
    }

    const { data: brandProfile } = await admin
      .from('profile_brands')
      .select(
        'company_name, website, industry, vat_number, address_line1, address_line2, address_city, address_postal_code, address_country, created_at, updated_at'
      )
      .eq('user_id', id)
      .maybeSingle();

    const { data: creatorProfile } = await admin
      .from('profile_creators')
      .select('first_name, last_name, handle, primary_platform, followers, avg_views, created_at, updated_at')
      .eq('user_id', id)
      .maybeSingle();

    const { data: orgMemberships, error: orgError } = await admin
      .from('org_members')
      .select('org_id, role_in_org, org:orgs(id, name, billing_email)')
      .eq('user_id', id);
    if (orgError) {
      throw createError('DATABASE_ERROR', 'Failed to load org memberships', 500, orgError.message);
    }

    const { data: kyc } = await admin
      .from('kyc_checks')
      .select('provider, status, reason, reviewed_at, created_at, updated_at')
      .eq('user_id', id)
      .maybeSingle();

    const { data: riskFlags, error: riskError } = await admin
      .from('risk_flags')
      .select('id, reason, severity, resolved_at, created_at, updated_at')
      .eq('user_id', id)
      .order('created_at', { ascending: false });
    if (riskError) {
      throw createError('DATABASE_ERROR', 'Failed to load risk flags', 500, riskError.message);
    }

    return NextResponse.json({
      profile,
      brand_profile: brandProfile ?? null,
      creator_profile: creatorProfile ?? null,
      org_memberships: orgMemberships ?? [],
      kyc: kyc ?? null,
      risk_flags: riskFlags ?? [],
    });
  } catch (error) {
    return formatErrorResponse(error);
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { user } = await requireAdminPermission('users.write');
    await enforceAdminRateLimit(req, { route: 'admin:users:update', max: 10, windowMs: 60_000 });
    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch (csrfError) {
      throw createError('FORBIDDEN', 'Invalid CSRF token', 403, csrfError);
    }

    const body = await req.json();
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw createError('VALIDATION_ERROR', 'Invalid payload', 400, parsed.error.flatten());
    }

    const admin = getAdminClient();
    const { data: current, error: currentError } = await admin
      .from('profiles')
      .select('id, role, is_active')
      .eq('id', id)
      .single();

    if (currentError || !current) {
      throw createError('NOT_FOUND', 'User not found', 404, currentError?.message);
    }

    const updatePayload: Record<string, unknown> = {};
    if (parsed.data.role) {
      updatePayload.role = parsed.data.role;
    }
    if (typeof parsed.data.is_active === 'boolean') {
      updatePayload.is_active = parsed.data.is_active;
    }

    if (Object.keys(updatePayload).length === 0) {
      throw createError('VALIDATION_ERROR', 'No changes provided', 400);
    }

    const { data: updated, error: updateError } = await admin
      .from('profiles')
      .update(updatePayload)
      .eq('id', id)
      .select('id, role, is_active')
      .single();

    if (updateError) {
      throw createError('DATABASE_ERROR', 'Failed to update user', 500, updateError.message);
    }

    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'admin_user_update',
      table_name: 'profiles',
      row_pk: id,
      old_values: { role: current.role, is_active: current.is_active },
      new_values: updatePayload,
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    if (typeof parsed.data.is_active === 'boolean' && parsed.data.is_active !== current.is_active) {
      await admin.from('status_history').insert({
        table_name: 'profiles',
        row_id: id,
        old_status: current.is_active ? 'active' : 'inactive',
        new_status: parsed.data.is_active ? 'active' : 'inactive',
        changed_by: user.id,
      });
    }

    return NextResponse.json({ ok: true, user: updated });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
