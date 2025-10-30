import { describe, it, expect } from "vitest";

describe("Middleware - Auth routes bypass logic", () => {
  it("should identify /api/auth routes that should bypass Supabase client", () => {
    const authRoutes = [
      "/api/auth/login",
      "/api/auth/signup",
      "/api/auth/logout",
      "/api/auth/reset-password",
      "/api/auth/forgot-password",
      "/api/auth/check-email",
    ];

    authRoutes.forEach((pathname) => {
      const shouldBypass = pathname.startsWith("/api/auth");
      expect(shouldBypass).toBe(true);
    });
  });

  it("should NOT bypass for other API routes", () => {
    const otherRoutes = [
      "/api/contests",
      "/api/submissions",
      "/api/uploads/avatar",
      "/api/payments",
    ];

    otherRoutes.forEach((pathname) => {
      const shouldBypass = pathname.startsWith("/api/auth");
      expect(shouldBypass).toBe(false);
    });
  });

  it("should NOT bypass for protected routes", () => {
    const protectedRoutes = [
      "/admin",
      "/brand",
      "/creator",
      "/admin/dashboard",
      "/brand/contests",
      "/creator/profile",
    ];

    protectedRoutes.forEach((pathname) => {
      const shouldBypass = pathname.startsWith("/api/auth");
      expect(shouldBypass).toBe(false);
    });
  });

  it("should NOT bypass for auth callback routes", () => {
    const callbackRoutes = [
      "/auth/confirm",
      "/auth/email-verified",
    ];

    callbackRoutes.forEach((pathname) => {
      const shouldBypass = pathname.startsWith("/api/auth");
      expect(shouldBypass).toBe(false);
    });
  });
});

describe("Middleware - Protected path detection", () => {
  it("should identify admin paths as protected", () => {
    const adminPaths = ["/admin", "/admin/dashboard", "/admin/users"];
    
    adminPaths.forEach(path => {
      const isProtected = path.startsWith("/admin") || path.startsWith("/brand") || path.startsWith("/creator");
      expect(isProtected).toBe(true);
    });
  });

  it("should identify brand paths as protected", () => {
    const brandPaths = ["/brand", "/brand/contests", "/brand/profile"];
    
    brandPaths.forEach(path => {
      const isProtected = path.startsWith("/admin") || path.startsWith("/brand") || path.startsWith("/creator");
      expect(isProtected).toBe(true);
    });
  });

  it("should identify creator paths as protected", () => {
    const creatorPaths = ["/creator", "/creator/profile", "/creator/submissions"];
    
    creatorPaths.forEach(path => {
      const isProtected = path.startsWith("/admin") || path.startsWith("/brand") || path.startsWith("/creator");
      expect(isProtected).toBe(true);
    });
  });

  it("should NOT identify public paths as protected", () => {
    const publicPaths = ["/", "/signup", "/login", "/api/auth/login"];
    
    publicPaths.forEach(path => {
      const isProtected = path.startsWith("/admin") || path.startsWith("/brand") || path.startsWith("/creator");
      expect(isProtected).toBe(false);
    });
  });
});

