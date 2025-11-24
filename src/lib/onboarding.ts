// Source: Onboarding utilities
// Effects: Centralized logic for computing onboarding completion status
import { getSupabaseAdmin } from './supabase/server';
import type { UserRole } from './auth';

/**
 * Compute onboarding completion status based on role-specific requirements.
 * 
 * For creators: requires handle and primary_platform
 * For brands: requires company_name
 * 
 * @param admin - Supabase admin client
 * @param role - User role (creator, brand, admin)
 * @param userId - User ID
 * @returns true if onboarding is complete, false otherwise
 */
export async function computeOnboardingComplete(
  admin: ReturnType<typeof getSupabaseAdmin>,
  role: UserRole,
  userId: string
): Promise<boolean> {
  if (role === 'creator') {
    const { data: creator } = await admin
      .from('profile_creators')
      .select('handle, primary_platform')
      .eq('user_id', userId)
      .single();
    const { data: profile } = await admin
      .from('profiles')
      .select('bio')
      .eq('id', userId)
      .single();
    return !!(creator?.handle && creator?.primary_platform && profile?.bio);
  }

  if (role === 'brand') {
    const { data: brand } = await admin
      .from('profile_brands')
      .select('company_name')
      .eq('user_id', userId)
      .single();
    return !!brand?.company_name;
  }

  // Admin role doesn't require onboarding
  if (role === 'admin') {
    return true;
  }

  return false;
}

