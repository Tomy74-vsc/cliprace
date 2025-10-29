import { NextRequest } from "next/server";

/**
 * Pass 1 shim: keep public API surface intact while disabling CSRF handling.
 * This avoids breaking existing imports during the transition to bearer-only auth.
 */

export const csrfConfig = {
  tokenLength: 0,
  expirationTime: 0,
  headerName: "x-csrf-token",
  cookieName: "csrf-token",
};

export async function getCsrfToken(): Promise<string> {
  return "";
}

export function generateCSRFToken(): string {
  return "";
}

export function storeCSRFToken(_sessionId: string, _token: string): void {
  // no-op
}

export function validateCSRFToken(_sessionId: string, _providedToken: string): boolean {
  return true;
}

export function getSessionId(_request: NextRequest): string {
  return "csrf-shim-session";
}

export function validateCSRF(_request: NextRequest): { valid: boolean; error?: string } {
  return { valid: true };
}

export function getNewCSRFToken(_sessionId: string): string {
  return "";
}

export const protectedEndpoints: string[] = [];

export function requiresCSRFProtection(_pathname: string): boolean {
  return false;
}
