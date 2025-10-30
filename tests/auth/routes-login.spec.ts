/**
 * Tests d'intégration pour la route de connexion
 * Teste la validation et le rate limiting
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';

// Mock Next.js dependencies
vi.mock('next/server', () => ({
  NextRequest: class NextRequest {
    headers: Map<string, string>;
    cookies: Map<string, { value: string }>;
    url: string;
    json: () => Promise<any>;
    
    constructor(url: string, init?: any) {
      this.url = url;
      this.headers = new Map(Object.entries(init?.headers || {}));
      this.cookies = new Map();
      this.json = init?.body ? async () => JSON.parse(init.body) : async () => ({});
    }
    
    get(name: string) {
      return this.headers.get(name);
    }
  },
  NextResponse: {
    json: (data: any, init?: any) => ({
      json: async () => data,
      status: init?.status || 200,
      ok: (init?.status || 200) >= 200 && (init?.status || 200) < 300,
      headers: new Map(Object.entries(init?.headers || {})),
    }),
  },
}));

// Mock Supabase
vi.mock('@/lib/supabase/server', () => ({
  getServerSupabase: vi.fn(() => ({
    auth: {
      signInWithPassword: vi.fn(({ email, password }) => {
        if (email === 'valid@example.com' && password === 'ValidP@ss1') {
          return {
            data: {
              user: {
                id: 'user-123',
                email: 'valid@example.com',
                email_confirmed_at: new Date().toISOString(),
              },
              session: { access_token: 'token-123' },
            },
            error: null,
          };
        }
        return {
          data: null,
          error: { message: 'Invalid login credentials' },
        };
      }),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({
            data: { role: 'creator' },
            error: null,
          })),
        })),
      })),
    })),
  })),
}));

// Mock Rate Limiting
vi.mock('@/lib/rate-limit', () => ({
  withRateLimit: vi.fn((endpoint: string) => (handler: Function) => handler),
}));

// Mock Audit Logger
vi.mock('@/lib/audit-logger', () => ({
  logLoginAttempt: vi.fn(),
}));

describe('POST /api/auth/login', () => {
  const validPayload = {
    email: 'valid@example.com',
    password: 'ValidP@ss1',
  };

  it('should reject malformed JSON', async () => {
    const { POST } = await import('@/app/api/auth/login/route');
    
    const request = {
      json: async () => {
        throw new Error('Invalid JSON');
      },
      headers: {
        get: () => null,
      },
    } as any;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('invalide');
  });

  it('should reject invalid email format', async () => {
    const { POST } = await import('@/app/api/auth/login/route');
    
    const request = {
      json: async () => ({ email: 'invalid', password: 'ValidP@ss1' }),
      headers: {
        get: () => null,
      },
    } as any;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Paramètres invalides');
  });

  it('should reject missing password', async () => {
    const { POST } = await import('@/app/api/auth/login/route');
    
    const request = {
      json: async () => ({ email: 'valid@example.com' }),
      headers: {
        get: () => null,
      },
    } as any;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
  });

  it('should return 401 for invalid credentials', async () => {
    const { POST } = await import('@/app/api/auth/login/route');
    
    const request = {
      json: async () => ({ 
        email: 'wrong@example.com', 
        password: 'WrongP@ss1' 
      }),
      headers: {
        get: () => null,
      },
    } as any;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain('incorrect');
  });

  it('should successfully login with valid credentials', async () => {
    const { POST } = await import('@/app/api/auth/login/route');
    
    const request = {
      json: async () => validPayload,
      headers: {
        get: () => null,
      },
    } as any;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.role).toBe('creator');
  });
});






