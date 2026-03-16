/**
 * Client-side CSRF token reader.
 * Reads the signed CSRF token directly from document.cookie
 * (__Host-csrf in production, csrf in development).
 */

export function getCsrfToken(): string {
  if (typeof document === 'undefined') return '';
  const cookies = document.cookie.split(';').map((c) => c.trim());
  const csrf = cookies
    .find((c) => c.startsWith('__Host-csrf=') || c.startsWith('csrf='))
    ?.split('=')
    .slice(1)
    .join('=');
  return csrf ?? '';
}

export function clearCsrfToken(): void {
  // No-op: cookie is managed by middleware / API route.
}
