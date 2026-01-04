import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { createError, formatErrorResponse } from '@/lib/errors';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminPermission('brands.read');
    const { id } = await params;
    const admin = getAdminClient();

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, email, display_name, role, is_active, onboarding_complete, created_at, updated_at')
      .eq('id', id)
      .single();

    if (profileError || !profile) {
      throw createError('NOT_FOUND', 'Brand not found', 404, profileError?.message);
    }
    if (profile.role !== 'brand') {
      throw createError('NOT_FOUND', 'Brand not found', 404);
    }

    const { data: brandProfile } = await admin
      .from('profile_brands')
      .select(
        'company_name, website, industry, vat_number, address_line1, address_line2, address_city, address_postal_code, address_country, created_at, updated_at'
      )
      .eq('user_id', id)
      .maybeSingle();

    const { data: orgMemberships, error: orgError } = await admin
      .from('org_members')
      .select('org_id, role_in_org, org:orgs(id, name, billing_email)')
      .eq('user_id', id);
    if (orgError) {
      throw createError('DATABASE_ERROR', 'Failed to load org memberships', 500, orgError.message);
    }

    return NextResponse.json({
      profile,
      brand_profile: brandProfile ?? null,
      org_memberships: orgMemberships ?? [],
    });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
