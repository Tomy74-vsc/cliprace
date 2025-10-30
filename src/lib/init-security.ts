/**
 * Initialisation des systèmes de sécurité
 * Script d'initialisation pour les systèmes de sécurité au démarrage de l'application
 */

import { initPersistentRateLimit } from './rate-limit';

/**
 * Initialise tous les systèmes de sécurité
 */
export async function initSecuritySystems(): Promise<void> {
  try {
    console.log('🔒 Initialisation des systèmes de sécurité...');

    // Initialiser le rate limiting persistant (Redis optionnel)
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      await initPersistentRateLimit(redisUrl);
      console.log('✅ Rate limiting persistant activé (Redis)');
    } else {
      await initPersistentRateLimit();
      console.log('✅ Rate limiting en mémoire activé');
    }

    console.log('✅ Systèmes de sécurité initialisés');
    console.log('🔒 initSecuritySystems OK');
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation des systèmes de sécurité:', error);
    throw error;
  }
}

/**
 * Vérifie la configuration de sécurité
 */
export function validateSecurityConfig(): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  // Vérifier les variables d'environnement critiques
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    issues.push('NEXT_PUBLIC_SUPABASE_URL manquante');
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    issues.push('NEXT_PUBLIC_SUPABASE_ANON_KEY manquante');
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    issues.push('SUPABASE_SERVICE_ROLE_KEY manquante');
  }

  // Vérifier la configuration Redis (optionnelle)
  if (process.env.REDIS_URL) {
    try {
      new URL(process.env.REDIS_URL);
    } catch {
      issues.push('REDIS_URL format invalide');
    }
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Obtient le statut des systèmes de sécurité
 */
export async function getSecurityStatus(): Promise<{
  rateLimit: 'memory' | 'redis' | 'error';
  auditLogs: 'enabled' | 'error';
  antivirus: 'enabled' | 'error';
}> {
  const status: {
    rateLimit: 'memory' | 'redis' | 'error';
    auditLogs: 'enabled' | 'error';
    antivirus: 'enabled' | 'error';
  } = {
    rateLimit: 'memory',
    auditLogs: 'enabled',
    antivirus: 'enabled'
  };

  try {
    // Vérifier le rate limiting
    if (process.env.REDIS_URL) {
      status.rateLimit = 'redis';
    }
  } catch {
    status.rateLimit = 'error';
  }

  try {
    // Vérifier les audit logs
    const { getAdminSupabase } = await import('./supabase/admin');
    getAdminSupabase();
  } catch {
    status.auditLogs = 'error';
  }

  return status;
}
