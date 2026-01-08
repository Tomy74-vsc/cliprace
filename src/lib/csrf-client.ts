let cachedToken: string | null = null;
let pendingRequest: Promise<string> | null = null;

export async function getCsrfToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  if (pendingRequest) return pendingRequest;

  pendingRequest = fetch('/api/auth/csrf', {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  })
    .then(async (res) => {
      const data = await res.json().catch(() => ({}));
      const token = typeof (data as { token?: unknown } | null)?.token === 'string' ? (data as { token: string }).token : null;
      if (!res.ok || !token) {
        throw new Error('CSRF token unavailable');
      }
      cachedToken = token;
      return token;
    })
    .finally(() => {
      pendingRequest = null;
    });

  return pendingRequest;
}

export function clearCsrfToken() {
  cachedToken = null;
}
