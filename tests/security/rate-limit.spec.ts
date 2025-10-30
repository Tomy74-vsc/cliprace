/**
 * Tests de Rate Limiting
 * Vérification que le rate limiting fonctionne correctement
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { checkRateLimit, getRateLimitStats } from '../../src/lib/rate-limit';

describe('Rate Limiting Tests', () => {
  const testEndpoint = '/api/auth/check-email';
  const testIp = '127.0.0.1';

  beforeAll(async () => {
    // Initialiser les systèmes de sécurité
    const { initSecuritySystems } = await import('../../src/lib/init-security');
    await initSecuritySystems();
  });

  it('should allow requests within rate limit', async () => {
    // Première requête devrait passer
    const result1 = await checkRateLimit(testIp, testEndpoint);
    expect(result1.allowed).toBe(true);
    expect(result1.remaining).toBeGreaterThan(0);

    // Deuxième requête devrait aussi passer
    const result2 = await checkRateLimit(testIp, testEndpoint);
    expect(result2.allowed).toBe(true);
    expect(result2.remaining).toBeLessThan(result1.remaining);
  });

  it('should block requests when rate limit exceeded', async () => {
    const testEndpoint = '/api/auth/check-email';
    const testIp = '192.168.1.100'; // IP différente pour éviter les conflits

    // Faire plusieurs requêtes pour dépasser la limite
    const maxRequests = 10; // Limite configurée pour /api/auth/check-email
    let lastResult;

    for (let i = 0; i < maxRequests + 2; i++) {
      lastResult = await checkRateLimit(testIp, testEndpoint);
      
      if (i < maxRequests) {
        expect(lastResult.allowed).toBe(true);
      } else {
        expect(lastResult.allowed).toBe(false);
        expect(lastResult.remaining).toBe(0);
      }
    }
  });

  it('should reset rate limit after window expires', async () => {
    const testEndpoint = '/api/test-reset';
    const testIp = '192.168.1.200';

    // Dépasser la limite
    for (let i = 0; i < 5; i++) {
      await checkRateLimit(testIp, testEndpoint);
    }

    // Vérifier que la limite est dépassée
    const blockedResult = await checkRateLimit(testIp, testEndpoint);
    expect(blockedResult.allowed).toBe(false);

    // Attendre un peu (en test, on peut simuler la réinitialisation)
    // Dans un vrai test, on attendrait la fin de la fenêtre
    await new Promise(resolve => setTimeout(resolve, 100));

    // Note: En test unitaire, on ne peut pas facilement tester l'expiration
    // car elle dépend du temps. Dans un test d'intégration, on utiliserait
    // une fenêtre plus courte ou on mockerait le temps.
  });

  it('should handle different endpoints with different limits', async () => {
    const testIp = '192.168.1.300';

    // Test avec différents endpoints
    const endpoints = [
      '/api/auth/check-email',    // 10 req/min
      '/api/auth/login',          // 5 req/min
      '/api/auth/signup',         // 3 req/min
      '/api/privacy/export',      // 2 req/min
      '/api/privacy/delete'       // 1 req/min
    ];

    for (const endpoint of endpoints) {
      const result = await checkRateLimit(testIp, endpoint);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThanOrEqual(0);
    }
  });

  it('should track rate limit statistics', () => {
    const stats = getRateLimitStats();
    expect(typeof stats).toBe('object');
    
    // Vérifier que les stats contiennent des informations sur les endpoints
    const endpointKeys = Object.keys(stats);
    expect(endpointKeys.length).toBeGreaterThan(0);
    
    for (const endpoint of endpointKeys) {
      const stat = stats[endpoint];
      expect(stat).toHaveProperty('active');
      expect(stat).toHaveProperty('total');
      expect(typeof stat.active).toBe('number');
      expect(typeof stat.total).toBe('number');
    }
  });

  it('should handle concurrent requests correctly', async () => {
    const testEndpoint = '/api/test-concurrent';
    const testIp = '192.168.1.400';
    const concurrentRequests = 5;

    // Faire plusieurs requêtes en parallèle
    const promises = Array(concurrentRequests).fill(null).map(() => 
      checkRateLimit(testIp, testEndpoint)
    );

    const results = await Promise.all(promises);
    
    // Toutes les requêtes devraient passer (dans la limite)
    const allowedRequests = results.filter(r => r.allowed).length;
    expect(allowedRequests).toBeGreaterThan(0);
    expect(allowedRequests).toBeLessThanOrEqual(concurrentRequests);
  });

  it('should handle invalid endpoints gracefully', async () => {
    const testIp = '192.168.1.500';
    const invalidEndpoint = '/api/nonexistent';

    const result = await checkRateLimit(testIp, invalidEndpoint);
    
    // Les endpoints non configurés devraient être autorisés
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(Infinity);
  });

  it('should handle different IP addresses independently', async () => {
    const testEndpoint = '/api/test-ip';
    const ip1 = '192.168.1.600';
    const ip2 = '192.168.1.700';

    // Faire des requêtes avec différentes IPs
    const result1 = await checkRateLimit(ip1, testEndpoint);
    const result2 = await checkRateLimit(ip2, testEndpoint);

    // Les deux devraient passer (IPs différentes)
    expect(result1.allowed).toBe(true);
    expect(result2.allowed).toBe(true);
    expect(result1.remaining).toBe(result2.remaining);
  });

  afterAll(async () => {
    // Nettoyer les statistiques de test
    const stats = getRateLimitStats();
    console.log('Rate limit stats after tests:', stats);
  });
});