// Source: CSRF protection (double-submit cookie + header) (§4, §147-149)
// Effects: generate crypto-secure token, validate on POST/PUT/DELETE
import { randomBytes } from 'crypto';

const CSRF_COOKIE_NAME = 'csrf';
const CSRF_HEADER_NAME = 'x-csrf';

/**
 * Generate a crypto-secure CSRF token (32 bytes, base64url encoded).
 * Edge Runtime compatible (uses Web Crypto API if available, falls back to Node.js crypto).
 */
export function generateCsrfToken(): string {
  // Use Web Crypto API for Edge Runtime compatibility (middleware)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    // Convert to base64url
    const base64 = Buffer.from(array).toString('base64');
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }
  // Fallback to Node.js crypto (for server-side)
  return randomBytes(32).toString('base64url');
}

/**
 * Generate a CSRF token value.
 * Note: cookie setting is handled in /api/auth/csrf and middleware.
 */
export function getCsrfToken(): string {
  return generateCsrfToken();
}

/**
 * Assert CSRF token validity (double-submit: cookie must match header).
 * Throws if invalid.
 */
export function assertCsrf(cookieHeader?: string | null, headerValue?: string | null): void {
  const cookieValue = getCookieFromHeader(cookieHeader, CSRF_COOKIE_NAME);

  if (!cookieValue) {
    throw new Error('CSRF token cookie missing');
  }

  if (!headerValue) {
    throw new Error('CSRF token header missing');
  }

  // Constant-time comparison to prevent timing attacks
  if (!constantTimeEqual(cookieValue, headerValue)) {
    throw new Error('CSRF token mismatch');
  }
}

function getCookieFromHeader(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null;

  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const [rawName, ...rest] = pair.trim().split('=');
    if (!rawName) continue;
    if (rawName === name) {
      return rest.join('=');
    }
  }

  return null;
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Get CSRF header name (for client-side usage).
 */
export function getCsrfHeaderName(): string {
  return CSRF_HEADER_NAME;
}
