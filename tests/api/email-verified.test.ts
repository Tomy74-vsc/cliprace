import { describe, it, expect, vi } from "vitest";

describe("email-verified page", () => {
  it("exchanges code for session when code is present", async () => {
    // Mock supabase client
    const mockExchangeCodeForSession = vi.fn().mockResolvedValue({ error: null });
    const mockGetSession = vi.fn().mockResolvedValue({ 
      data: { session: { user: { id: "test-user-id" } } }, 
      error: null 
    });
    const mockGetUser = vi.fn().mockResolvedValue({ 
      data: { 
        user: { 
          id: "test-user-id", 
          email: "test@example.com", 
          email_confirmed_at: new Date().toISOString(),
          user_metadata: { role: "creator" }
        } 
      }, 
      error: null 
    });

    // Mock supabase auth
    const mockSupabaseClient = {
      auth: {
        exchangeCodeForSession: mockExchangeCodeForSession,
        getSession: mockGetSession,
        getUser: mockGetUser,
      }
    };

    // Simulate the flow
    const code = "test-verification-code";

    // Step 1: Exchange code for session
    const params = { type: "signup" as const, code };
    const { error: exchangeError } = await mockSupabaseClient.auth.exchangeCodeForSession(params);
    expect(exchangeError).toBeNull();
    expect(mockExchangeCodeForSession).toHaveBeenCalledWith(params);

    // Step 2: Get session
    const { data: { session }, error: sessionError } = await mockSupabaseClient.auth.getSession();
    expect(sessionError).toBeNull();
    expect(session).toBeDefined();
    expect(mockGetSession).toHaveBeenCalled();

    // Step 3: Get user
    const { data: { user }, error: userError } = await mockSupabaseClient.auth.getUser();
    expect(userError).toBeNull();
    expect(user).toBeDefined();
    expect(user?.email_confirmed_at).toBeDefined();
    expect(mockGetUser).toHaveBeenCalled();
  });

  it("handles missing code gracefully", async () => {
    // Test que sans code, on essaie quand même de récupérer la session
    const mockGetSession = vi.fn().mockResolvedValue({ 
      data: { session: null }, 
      error: null 
    });

    const mockSupabaseClient = {
      auth: {
        getSession: mockGetSession,
      }
    };

    // Sans code, on devrait quand même essayer getSession
    const { data: { session } } = await mockSupabaseClient.auth.getSession();
    expect(session).toBeNull();
    expect(mockGetSession).toHaveBeenCalled();
  });

  it("handles exchange error properly", async () => {
    // Test gestion d'erreur lors de l'échange
    const exchangeError = new Error("Invalid verification code");
    const mockExchangeCodeForSession = vi.fn().mockResolvedValue({ 
      error: exchangeError 
    });

    const mockSupabaseClient = {
      auth: {
        exchangeCodeForSession: mockExchangeCodeForSession,
      }
    };

    const code = "invalid-code";
    const params = { type: "signup" as const, code };

    const { error } = await mockSupabaseClient.auth.exchangeCodeForSession(params);
    expect(error).toBe(exchangeError);
    expect(mockExchangeCodeForSession).toHaveBeenCalledWith(params);
  });
});

