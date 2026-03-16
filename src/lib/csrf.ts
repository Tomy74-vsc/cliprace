import { createHmac, timingSafeEqual, randomBytes } from 'crypto';

const SECRET = process.env.CSRF_HMAC_SECRET ?? '';

function getSecret(): string {
  if (!SECRET || SECRET.length < 32) {
    throw new Error('CSRF_HMAC_SECRET must be set and at least 32 characters');
  }
  return SECRET;
}

function hmacSha256Hex(secret: string, data: string): string {
  return createHmac('sha256', secret).update(data).digest('hex');
}

function constantTimeEqual(a: string, b: string): boolean {
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

/**
 * Mint a signed CSRF token: `sigHex.nonceHex`
 * sig = HMAC_SHA256(CSRF_HMAC_SECRET, binding!nonce)
 */
export function csrfMint(userId?: string, anonSid?: string): string {
  const secret = getSecret();
  const nonce = randomBytes(32).toString('hex');
  const binding = userId ? `uid:${userId}` : `anon:${anonSid ?? 'unknown'}`;
  const sig = hmacSha256Hex(secret, `${binding}!${nonce}`);
  return `${sig}.${nonce}`;
}

/**
 * Assert CSRF validity (OWASP Signed Double-Submit Cookie).
 *
 * 1. Extract token from cookie header (__Host-csrf or csrf fallback)
 * 2. Constant-time compare cookie value === x-csrf header value
 * 3. Verify HMAC signature against binding (userId or anonSid)
 *
 * Backward-compatible: callers that omit userId/anonSid fall back to 'anon:unknown'.
 */
export function assertCsrf(
  cookieHeader: string | null,
  csrfHeader: string | null,
  userId?: string,
  anonSid?: string,
): void {
  if (!cookieHeader || !csrfHeader) throw new Error('csrf_missing');

  const cookieToken =
    cookieHeader
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith('__Host-csrf=') || c.startsWith('csrf='))
      ?.split('=')
      .slice(1)
      .join('=') ?? null;

  if (!cookieToken) throw new Error('csrf_missing');
  if (!constantTimeEqual(csrfHeader, cookieToken))
    throw new Error('csrf_cookie_header_mismatch');

  const dotIdx = csrfHeader.indexOf('.');
  if (dotIdx === -1) throw new Error('csrf_malformed');

  const sigHex = csrfHeader.slice(0, dotIdx);
  const nonceHex = csrfHeader.slice(dotIdx + 1);
  if (!sigHex || !nonceHex) throw new Error('csrf_malformed');

  const secret = getSecret();
  const binding = userId ? `uid:${userId}` : `anon:${anonSid ?? 'unknown'}`;
  const expected = hmacSha256Hex(secret, `${binding}!${nonceHex}`);

  if (!constantTimeEqual(sigHex, expected)) throw new Error('csrf_bad_sig');
}

export function getCsrfHeaderName(): string {
  return 'x-csrf';
}
