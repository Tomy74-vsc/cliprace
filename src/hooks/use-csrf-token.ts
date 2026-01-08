'use client';

import { useEffect, useState } from 'react';
import { getCsrfToken } from '@/lib/csrf-client';

export function useCsrfToken(): string | null {
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const fetchToken = async () => {
      try {
        const token = await getCsrfToken();
        setCsrfToken(token);
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
