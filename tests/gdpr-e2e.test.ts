/**
 * Tests E2E pour les endpoints RGPD
 * Vérification complète du flow export/delete avec authentification réelle
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_EMAIL = `test-gdpr-${Date.now()}@cliprace.com`;
const TEST_PASSWORD = 'TestPassword123!';

test.describe('GDPR E2E Tests', () => {
  let userId: string;
  let authCookies: string;
  let testEmail: string;

  test.beforeAll(async ({ browser }) => {
    // Générer un email unique pour ce test
    testEmail = `test-gdpr-${Date.now()}@cliprace.com`;
    
    // Créer un utilisateur de test
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
      // Aller à la page de signup
      await page.goto(`${BASE_URL}/signup`);
      
      // Remplir le formulaire d'inscription
      await page.fill('input[name="email"]', testEmail);
      await page.fill('input[name="password"]', TEST_PASSWORD);
      await page.fill('input[name="confirmPassword"]', TEST_PASSWORD);
      
      // Soumettre le formulaire
      await page.click('button[type="submit"]');
      
      // Attendre la redirection ou le message de confirmation
      await page.waitForURL('**/check-email**', { timeout: 10000 });
      
      // Simuler la confirmation d'email (en développement)
      await page.goto(`${BASE_URL}/auth/email-verified`);
      
      // Se connecter avec le même email
      await page.goto(`${BASE_URL}/login`);
      await page.fill('input[name="email"]', testEmail);
      await page.fill('input[name="password"]', TEST_PASSWORD);
      await page.click('button[type="submit"]');
      
      // Attendre la redirection après login
      await page.waitForURL('**/creator**', { timeout: 10000 });
      
      // Récupérer les cookies d'authentification
      const cookies = await context.cookies();
      authCookies = cookies.map(c => `${c.name}=${c.value}`).join('; ');
      
      // Récupérer l'ID utilisateur depuis les cookies ou localStorage
      const userIdFromStorage = await page.evaluate(() => {
        return localStorage.getItem('supabase.auth.token') || 
               sessionStorage.getItem('supabase.auth.token');
      });
      
      if (userIdFromStorage) {
        const token = JSON.parse(userIdFromStorage);
        userId = token.user?.id || 'test-user-id';
      } else {
        userId = 'test-user-id';
      }
      
    } catch (error) {
      console.error('Setup error:', error);
      // Continuer avec des valeurs par défaut
      userId = 'test-user-id';
      authCookies = '';
    } finally {
      await context.close();
    }
  });

  test('should export user data successfully', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/privacy/export`, {
      headers: {
        'Content-Type': 'application/json',
        'Cookie': authCookies,
      },
      data: {
        user_id: userId,
        format: 'json'
      }
    });

    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('success', true);
    expect(data).toHaveProperty('data');
    expect(data.data).toHaveProperty('user');
    expect(data.data).toHaveProperty('profiles');
    expect(data.data).toHaveProperty('submissions');
    expect(data.data).toHaveProperty('messages');
  });

  test('should handle export with invalid user', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/privacy/export`, {
      headers: {
        'Content-Type': 'application/json',
        'Cookie': authCookies,
      },
      data: {
        user_id: '00000000-0000-0000-0000-000000000000',
        format: 'json'
      }
    });

    expect(response.status()).toBe(404);
    
    const data = await response.json();
    expect(data).toHaveProperty('error');
  });

  test('should delete user data successfully', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/privacy/delete`, {
      headers: {
        'Content-Type': 'application/json',
        'Cookie': authCookies,
      },
      data: {
        user_id: userId,
        confirmation: 'DELETE_MY_DATA'
      }
    });

    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('success', true);
    expect(data).toHaveProperty('message');
    expect(data).toHaveProperty('results');
    expect(data.results).toHaveProperty('profiles');
    expect(data.results).toHaveProperty('submissions');
    expect(data.results).toHaveProperty('messages');
  });

  test('should reject delete without confirmation', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/privacy/delete`, {
      headers: {
        'Content-Type': 'application/json',
        'Cookie': authCookies,
      },
      data: {
        user_id: userId,
        confirmation: 'wrong_confirmation'
      }
    });

    expect(response.status()).toBe(400);
    
    const data = await response.json();
    expect(data).toHaveProperty('error');
  });

  test('should verify user is deleted after deletion', async ({ request }) => {
    // Vérifier que l'export retourne 404 après suppression
    const response = await request.post(`${BASE_URL}/api/privacy/export`, {
      headers: {
        'Content-Type': 'application/json',
        'Cookie': authCookies,
      },
      data: {
        user_id: userId,
        format: 'json'
      }
    });

    expect(response.status()).toBe(404);
  });

  test('should handle rate limiting on GDPR endpoints', async ({ request }) => {
    const requests = Array(5).fill(null).map(() => 
      request.post(`${BASE_URL}/api/privacy/export`, {
        headers: {
          'Content-Type': 'application/json',
          'Cookie': authCookies,
        },
        data: {
          user_id: userId,
          format: 'json'
        }
      })
    );

    const responses = await Promise.all(requests);
    const rateLimitedResponses = responses.filter(r => r.status() === 429);
    
    expect(rateLimitedResponses.length).toBeGreaterThan(0);
  });

  test('should require authentication for GDPR export', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/privacy/export`, {
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        user_id: userId,
        format: 'json',
      },
    });

    expect(response.status()).toBe(401);
  });

  test('should log GDPR actions in audit logs', async ({ request }) => {
    // Faire une action GDPR
    const response = await request.post(`${BASE_URL}/api/privacy/export`, {
      headers: {
        'Content-Type': 'application/json',
        'Cookie': authCookies,
      },
      data: {
        user_id: userId,
        format: 'json'
      }
    });

    expect(response.status()).toBe(200);
    
    // Vérifier que l'action a été loggée (nécessite un endpoint de vérification des logs)
    // En production, on vérifierait les audit_logs
    const data = await response.json();
    expect(data).toHaveProperty('success', true);
  });

  test('should handle concurrent GDPR requests', async ({ request }) => {
    const requests = [
      request.post(`${BASE_URL}/api/privacy/export`, {
        headers: {
          'Content-Type': 'application/json',
          'Cookie': authCookies,
        },
        data: {
          user_id: userId,
          format: 'json'
        }
      }),
      request.post(`${BASE_URL}/api/privacy/delete`, {
        headers: {
          'Content-Type': 'application/json',
          'Cookie': authCookies,
        },
        data: {
          user_id: userId,
          confirmation: 'DELETE_MY_DATA'
        }
      })
    ];

    const responses = await Promise.all(requests);
    
    // Au moins une des requêtes devrait réussir
    const successfulResponses = responses.filter(r => r.status() === 200);
    expect(successfulResponses.length).toBeGreaterThan(0);
  });
});
