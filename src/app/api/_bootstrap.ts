/**
 * Bootstrap pour l'initialisation des systèmes de sécurité
 * Ce fichier est appelé au démarrage de l'application
 */

import { initSecuritySystems } from '@/lib/init-security';

let securityInitialized = false;

/**
 * Initialise les systèmes de sécurité une seule fois
 */
export async function bootstrapSecurity(): Promise<void> {
  if (securityInitialized) {
    return;
  }

  try {
    await initSecuritySystems();
    securityInitialized = true;
    console.log('🔒 Systèmes de sécurité initialisés avec succès');
  } catch (error) {
    console.error('❌ Échec de l\'initialisation des systèmes de sécurité:', error);
    // Ne pas faire échouer l'application, mais logger l'erreur
  }
}

/**
 * Vérifie si la sécurité est initialisée
 */
export function isSecurityInitialized(): boolean {
  return securityInitialized;
}
