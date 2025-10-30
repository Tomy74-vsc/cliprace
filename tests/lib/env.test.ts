import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Environment Variables Validation", () => {
  // Save original env
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Restore original env before each test
    process.env = { ...originalEnv };
    // Clear module cache to force re-import
    vi.resetModules();
  });

  it("should validate required environment variables", async () => {
    // Set up valid environment variables
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key-1234567890";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key-1234567890";

    // Dynamic import to get fresh env with new process.env
    const { env } = await import("../../src/lib/env");

    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://test.supabase.co");
    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe("test-anon-key-1234567890");
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBe("test-service-role-key-1234567890");
  });

  it("should throw error if NEXT_PUBLIC_SUPABASE_URL is missing", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key-1234567890";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key-1234567890";

    await expect(async () => {
      await import("../../src/lib/env");
    }).rejects.toThrow();
  });

  it("should throw error if NEXT_PUBLIC_SUPABASE_URL is not a valid URL", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "not-a-url";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key-1234567890";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key-1234567890";

    await expect(async () => {
      await import("../../src/lib/env");
    }).rejects.toThrow();
  });

  it("should throw error if SUPABASE_SERVICE_ROLE_KEY is too short", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key-1234567890";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "short"; // Less than 10 characters

    await expect(async () => {
      await import("../../src/lib/env");
    }).rejects.toThrow();
  });

  it("should allow optional variables to be undefined", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key-1234567890";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key-1234567890";
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;

    const { env } = await import("../../src/lib/env");

    expect(env.NEXT_PUBLIC_APP_URL).toBeUndefined();
    expect(env.NEXT_PUBLIC_SITE_URL).toBeUndefined();
  });
});

describe("Admin Client Security", () => {
  beforeEach(() => {
    // Ensure clean state before each test
    delete (global as any).window;
    vi.resetModules();
  });

  it("should not throw error when imported server-side", async () => {
    // Ensure window is not defined (server-side)
    delete (global as any).window;

    // This should not throw
    const adminModule = await import("../../src/lib/supabase/admin");
    expect(adminModule).toBeDefined();
    expect(adminModule.getAdminSupabase).toBeDefined();
  });

  it("should throw error when imported client-side", async () => {
    // Mock window to simulate client-side
    (global as any).window = {};

    await expect(async () => {
      await import("../../src/lib/supabase/admin");
    }).rejects.toThrow("SUPABASE_SERVICE_ROLE_KEY must never be imported client-side");

    // Clean up
    delete (global as any).window;
  });
});

describe("Server-side validation", () => {
  it("should validate server environment successfully", async () => {
    // Set up valid server environment
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key-1234567890";

    const { validateServerEnv } = await import("../../src/lib/env");

    expect(() => validateServerEnv()).not.toThrow();
  });

  it("should throw error when validateServerEnv is called client-side", async () => {
    (global as any).window = {};

    const { validateServerEnv } = await import("../../src/lib/env");

    expect(() => validateServerEnv()).toThrow("validateServerEnv() should only be called server-side");

    delete (global as any).window;
  });

  it("should throw error if SUPABASE_SERVICE_ROLE_KEY is missing", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const { validateServerEnv } = await import("../../src/lib/env");

    expect(() => validateServerEnv()).toThrow("SUPABASE_SERVICE_ROLE_KEY is required");
  });
});

describe("Client-side validation", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key-1234567890";
  });

  it("should validate client environment successfully", async () => {
    const { validateClientEnv } = await import("../../src/lib/env");

    expect(() => validateClientEnv()).not.toThrow();
  });

  it("should throw error if client-safe variables are missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    const { validateClientEnv } = await import("../../src/lib/env");

    expect(() => validateClientEnv()).toThrow();
  });
});

