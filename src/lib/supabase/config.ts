/**
 * Configuration centralisée pour Supabase SSR
 */

import type { SupabaseConfig } from './types';

/**
 * Vérifie que les variables d'environnement requises sont définies
 */
function validateEnvironment(): void {
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(
      `Variables d'environnement manquantes: ${missingVars.join(', ')}\n` +
      'Vérifiez votre fichier .env.local'
    );
  }
}

/**
 * Configuration Supabase avec validation
 */
export function getSupabaseConfig(): SupabaseConfig {
  validateEnvironment();

  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

/**
 * Configuration des cookies optimisée
 */
export const cookieConfig = {
  // Configuration pour la production
  production: {
    httpOnly: true,
    secure: true,
    sameSite: 'lax' as const,
    path: '/',
  },
  // Configuration pour le développement
  development: {
    httpOnly: true,
    secure: false,
    sameSite: 'lax' as const,
    path: '/',
  },
} as const;

/**
 * Obtient la configuration des cookies selon l'environnement
 */
export function getCookieConfig() {
  return process.env.NODE_ENV === 'production' 
    ? cookieConfig.production 
    : cookieConfig.development;
}

/**
 * Configuration des routes protégées
 */
export const protectedRoutes = [
  '/admin',
  '/brand',
  '/creator',
] as const;

/**
 * Configuration des routes d'authentification
 */
export const authRoutes = [
  '/auth/confirm',
  '/auth/email-verified',
  '/login',
  '/signup',
] as const;

/**
 * Vérifie si une route est protégée
 */
export function isProtectedRoute(pathname: string): boolean {
  return protectedRoutes.some(route => pathname.startsWith(route));
}

/**
 * Vérifie si une route est liée à l'authentification
 */
export function isAuthRoute(pathname: string): boolean {
  return authRoutes.some(route => pathname.startsWith(route));
}
