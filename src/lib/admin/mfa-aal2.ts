import { redirect } from 'next/navigation';

import { createError } from '@/lib/errors';
import { getSupabaseSSR } from '@/lib/supabase/ssr';

export type AdminMfaRedirectTarget = '/app/admin/mfa/setup' | '/app/admin/mfa/verify';

export type AdminMfaState = {
  currentLevel: string;
  nextLevel: string;
  hasTotp: boolean;
};

export async function getAdminMfaState(): Promise<AdminMfaState> {
  const supabase = await getSupabaseSSR();

  const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalError || !aal) {
    throw createError('UNAUTHORIZED', 'Authentification requise', 401, aalError?.message);
  }

  const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
  if (factorsError) {
    throw createError('UNAUTHORIZED', 'Authentification requise', 401, factorsError.message);
  }

  const hasTotp = Boolean((factors?.totp ?? []).length > 0);
  return {
    currentLevel: aal.currentLevel ?? 'unknown',
    nextLevel: aal.nextLevel ?? 'unknown',
    hasTotp,
  };
}

export function getAdminMfaRedirectTarget(state: AdminMfaState): AdminMfaRedirectTarget {
  return state.hasTotp ? '/app/admin/mfa/verify' : '/app/admin/mfa/setup';
}

export async function enforceAdminAal2OrRedirect() {
  const state = await getAdminMfaState();
  if (state.currentLevel !== 'aal2') {
    redirect(getAdminMfaRedirectTarget(state));
  }
}

export async function requireAdminAal2OrThrow() {
  const state = await getAdminMfaState();
  if (state.currentLevel !== 'aal2') {
    throw createError('FORBIDDEN', 'MFA requise pour accéder à l’interface admin', 403, {
      currentLevel: state.currentLevel,
      redirectTo: getAdminMfaRedirectTarget(state),
    });
  }
}


