'use client';

import { useEffect, useState } from 'react';

export function useCsrfToken(): string | null {
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const fetchToken = async () => {
      try {
        const response = await fetch('/api/auth/csrf', {
          method: 'GET',
          credentials: 'include',
          signal: controller.signal,
        });

        const data = await response.json();
        if (response.ok && data?.ok && data.token) {
          setCsrfToken(data.token);
        } else {
          console.error('Failed to retrieve CSRF token', data);
        }
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          return;
        }
        console.error('Error fetching CSRF token', error);
      }
    };

    fetchToken();

    return () => {
      controller.abort();
    };
  }, []);

  return csrfToken;
}
