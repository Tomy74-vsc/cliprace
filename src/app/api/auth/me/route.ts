// Source: GET /api/auth/me (§6, §1170-1171)
// Effects: return profile + role + onboarding flags
import { NextRequest, NextResponse } from 'next/server';
import { getSession, getUserRole } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { formatErrorResponse, createError } from '@/lib/errors';
import { computeOnboardingComplete } from '@/lib/onboarding';

export async function GET(_req: NextRequest) {
  try {
    const { user, error } = await getSession();
    
    if (error || !user) {
      return formatErrorResponse(createError('UNAUTHORIZED', 'Non authentifié', 401));
    }

    const role = await getUserRole(user.id);
    
    if (!role) {
      return formatErrorResponse(createError('NOT_FOUND', 'Profil non trouvé', 404));
    }

    const admin = getSupabaseAdmin();

    // Récupérer le profil complet
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, role, email, display_name, avatar_url, bio, country, is_active, created_at, updated_at, onboarding_complete')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return formatErrorResponse(
        createError('NOT_FOUND', 'Profil non trouvé', 404, profileError)
      );
    }

    // Récupérer les détails spécifiques selon le rôle
    let roleSpecificData = null;

    if (role === 'creator') {
      const { data: creator } = await admin
        .from('profile_creators')
        .select('handle, primary_platform, followers, avg_views')
        .eq('user_id', user.id)
        .single();
      
      roleSpecificData = creator;
    } else if (role === 'brand') {
      const { data: brand } = await admin
        .from('profile_brands')
        .select('company_name, vat_number, address_line1')
        .eq('user_id', user.id)
        .single();
      
      roleSpecificData = brand;
    }

    // Calculer le statut d'onboarding avec la fonction centralisée
    const onboardingComplete = await computeOnboardingComplete(admin, role, user.id);

    return NextResponse.json({
      ok: true,
      user: {
        id: profile.id,
        email: profile.email,
        role: profile.role,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        bio: profile.bio,
        country: profile.country,
        is_active: profile.is_active,
      },
      role_specific: roleSpecificData,
      onboarding_complete: onboardingComplete ?? profile.onboarding_complete ?? false,
    });
  } catch (error: unknown) {
    return formatErrorResponse(error);
  }
}
