import { useCallback, useMemo } from "react";

export interface UseCsrfTokenResult {
  token: string | null;
  loading: boolean;
  ready: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  ensureReady: (options?: { timeoutMs?: number }) => Promise<string | null>;
}

/**
 * Pass 1 shim: keep the hook signature stable while disabling CSRF behaviour.
 */
export function useCsrfToken(): UseCsrfTokenResult {
  const refresh = useCallback(async () => {
    // no-op
  }, []);

  const ensureReady = useCallback(async () => null, []);

  return useMemo(
    () => ({
      token: null,
      loading: false,
      ready: true,
      error: null,
      refresh,
      ensureReady,
    }),
    [ensureReady, refresh],
  );
}
