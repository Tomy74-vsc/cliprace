// Source: CSRF protection (double-submit cookie + header) (§4, §147-149)
// Effects: generate crypto-secure token, validate on POST/PUT/DELETE
import { cookies } from 'next/headers';
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
 * Get or generate CSRF token and set cookie (httpOnly, SameSite=Lax).
 * Should be called on GET requests for form pages.
 */
export function getCsrfToken(): string {
  const cookieStore = cookies();
  const existing = cookieStore.get(CSRF_COOKIE_NAME)?.value;

  if (existing) {
    return existing;
  }

  // Generate new token
  const token = generateCsrfToken();

  // Set cookie (httpOnly, SameSite=Lax, Secure in production)
  cookieStore.set(CSRF_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/',
  });

  return token;
}

/**
 * Assert CSRF token validity (double-submit: cookie must match header).
 * Throws if invalid.
 */
export function assertCsrf(headerValue?: string | null): void {
  const cookieStore = cookies();
  const cookieValue = cookieStore.get(CSRF_COOKIE_NAME)?.value;

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

