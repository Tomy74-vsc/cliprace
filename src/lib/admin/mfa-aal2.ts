import { redirect } from 'next/navigation';

import { createError } from '@/lib/errors';
import { getSupabaseSSR } from '@/lib/supabase/ssr';

export type AdminMfaRedirectTarget = '/app/admin/mfa/setup' | '/app/admin/mfa/verify';

export type AdminMfaState = {
  currentLevel: string;
  nextLevel: string;
  hasTotp: boolean;
};

type AnyFactor = {
  id?: string;
  factor_type?: string;
  factorType?: string;
};

function extractTotpFactors(raw: unknown): AnyFactor[] {
  const factors = raw as { totp?: unknown[]; all?: unknown[] } | null;
  const totp = Array.isArray(factors?.totp) ? (factors?.totp as AnyFactor[]) : [];
  const all = Array.isArray(factors?.all) ? (factors?.all as AnyFactor[]) : [];
  const totpFromAll = all.filter((f) => (f?.factor_type ?? f?.factorType) === 'totp');
  const byId = new Map<string, AnyFactor>();
  for (const f of [...totp, ...totpFromAll]) {
    const id = String(f?.id || '');
    if (!id) continue;
    byId.set(id, f);
  }
  return [...byId.values()];
}

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

  // Supabase peut renvoyer des facteurs "TOTP" via `all` selon l'état (en cours, etc.).
  // On regarde donc `totp` ET `all` pour éviter une boucle setup→enroll→erreur "already exists".
  const hasTotp = extractTotpFactors(factors).length > 0;
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


