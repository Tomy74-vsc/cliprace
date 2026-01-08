// Source: Auth helpers (Supabase SSR session, role guards) (§4, §6)
// Effects: getSession returns full profile (id, role) with error handling and session cleanup
import { getSupabaseSSR } from './supabase/ssr';
import { getSupabaseAdmin } from './supabase/server';

export type UserRole = 'creator' | 'brand' | 'admin';

export interface SessionUser {
  id: string;
  email: string;
  role: UserRole;
  display_name: string | null;
  avatar_url: string | null;
  is_active: boolean;
  onboarding_complete: boolean;
}

export interface SessionResult {
  user: SessionUser | null;
  error?: string;
}

/**
 * Get current session with full profile (id, role).
 * Respects RLS: tries SSR anon first, falls back to service role if RLS blocks.
 * Handles errors and invalid sessions (cleans up if needed).
 */
export async function getSession(): Promise<SessionResult> {
  try {
    const supabase = await getSupabaseSSR();
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    // No user or auth error
    if (authError || !authUser) {
      // Clean up invalid session cookies if present
      if (authError?.message?.includes('JWT') || authError?.message?.includes('expired')) {
        await supabase.auth.signOut();
      }
      return { user: null, error: authError?.message || 'Not authenticated' };
    }

    // Try to fetch profile via SSR anon (respects RLS)
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role, email, display_name, avatar_url, is_active, onboarding_complete')
      .eq('id', authUser.id)
      .single();

    // If RLS blocks, fallback to service role (server-only)
    if (profileError || !profile) {
      const admin = getSupabaseAdmin();
      const { data: adminProfile, error: adminError } = await admin
        .from('profiles')
        .select('id, role, email, display_name, avatar_url, is_active, onboarding_complete')
        .eq('id', authUser.id)
        .single();

      if (adminError || !adminProfile) {
        // Profile doesn't exist - invalid session, clean up
        await supabase.auth.signOut();
        return { user: null, error: 'Profile not found' };
      }

      // Check if account is active
      if (!adminProfile.is_active) {
        return { user: null, error: 'Account is inactive' };
      }

      return {
        user: {
          id: adminProfile.id,
          email: adminProfile.email,
          role: adminProfile.role as UserRole,
          display_name: adminProfile.display_name,
          avatar_url: adminProfile.avatar_url,
          is_active: adminProfile.is_active,
          onboarding_complete: adminProfile.onboarding_complete ?? false,
        },
      };
    }

    // Check if account is active
    if (!profile.is_active) {
      return { user: null, error: 'Account is inactive' };
    }

    // Return full profile
    return {
      user: {
        id: profile.id,
        email: profile.email,
        role: profile.role as UserRole,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        is_active: profile.is_active,
        onboarding_complete: profile.onboarding_complete ?? false,
      },
    };
  } catch (error) {
    // Unexpected error - clean up session
    try {
      const supabase = await getSupabaseSSR();
      await supabase.auth.signOut();
    } catch {
      // Ignore cleanup errors
    }
    return {
      user: null,
      error: error instanceof Error ? error.message : 'Session error',
    };
  }
}

/**
 * Get user role only (lightweight).
 * Respects RLS: tries SSR anon first, falls back to service role if RLS blocks.
 */
export async function getUserRole(userId: string): Promise<UserRole | null> {
  try {
    // Try SSR anon first (respects RLS)
    const supabase = await getSupabaseSSR();
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (!error && data) {
      return data.role as UserRole;
    }

    // Fallback to service role if RLS blocks
    const admin = getSupabaseAdmin();
    const { data: adminData, error: adminError } = await admin
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (adminError || !adminData) {
      return null;
    }

    return adminData.role as UserRole;
  } catch {
    return null;
  }
}

/**
 * Require a specific role, throws if not met.
 */
export async function requireRole(required: UserRole): Promise<void> {
  const { user, error } = await getSession();
  if (error || !user) {
    throw new Error('Unauthorized');
  }
  if (user.role !== required) {
    throw new Error('Forbidden');
  }
}

/**
 * Check if current user owns a resource.
 */
export function hasOwnership(resourceOwnerId: string, currentUserId: string): boolean {
  return resourceOwnerId === currentUserId;
}
