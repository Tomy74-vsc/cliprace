import { useState, useCallback, useRef, useEffect } from "react";

/**
 * Hook pour la validation asynchrone avec gestion des erreurs.
 */
export function useAsyncValidation<T, R>(validator: (value: T) => Promise<R>) {
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<R | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const validate = useCallback(
    async (value: T): Promise<R | null> => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsValidating(true);
      setError(null);

      try {
        const validationResult = await validator(value);

        if (!controller.signal.aborted) {
          setResult(validationResult);
          return validationResult;
        }

        return null;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return null;
        }

        if (!controller.signal.aborted) {
          const message = err instanceof Error ? err.message : "Erreur de validation";
          setError(message);
        }

        return null;
      } finally {
        if (abortControllerRef.current === controller) {
          setIsValidating(false);
        }
      }
    },
    [validator],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const reset = useCallback(() => {
    setIsValidating(false);
    setError(null);
    setResult(null);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  return {
    isValidating,
    error,
    result,
    validate,
    clearError,
    reset,
  };
}

/**
 * Hook pour la validation d'email avec verification de disponibilite.
 * Optimise avec cache pour eviter les appels redondants.
 */
const CACHE_TTL = 5 * 60 * 1000;

export function useEmailValidation() {
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const emailCache = useRef<Map<string, { result: boolean; timestamp: number }>>(new Map());
  const abortControllerRef = useRef<AbortController | null>(null);

  const checkEmailAvailability = useCallback(
    async (email: string): Promise<boolean | null> => {
      const normalizedEmail = email?.trim().toLowerCase();

      if (!normalizedEmail || !normalizedEmail.includes("@")) {
        setIsAvailable(null);
        setError(null);
        setIsChecking(false);
        return null;
      }

      const cached = emailCache.current.get(normalizedEmail);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        setIsAvailable(cached.result);
        setError(null);
        return cached.result;
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsChecking(true);
      setError(null);

      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch("/api/auth/check-email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: normalizedEmail }),
          signal: controller.signal,
        });

        if (!response.ok) {
          setIsAvailable(null);
          setError("http_error");
          return null;
        }

        const data = (await response.json().catch(() => null)) as
          | { available?: boolean }
          | null;
        const available =
          typeof data?.available === "boolean" ? data.available : null;

        if (available === null) {
          setIsAvailable(null);
          setError("invalid_response");
          return null;
        }

        emailCache.current.set(normalizedEmail, {
          result: available,
          timestamp: Date.now(),
        });

        setIsAvailable(available);
        setError(null);
        return available;
      } catch (err) {
        if (controller.signal.aborted) {
          return null;
        }

        setIsAvailable(null);
        setError("network_error");
        return null;
      } finally {
        clearTimeout(timeoutId);
        if (abortControllerRef.current === controller) {
          setIsChecking(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    const cleanup = () => {
      const now = Date.now();
      for (const [email, data] of emailCache.current.entries()) {
        if (now - data.timestamp > CACHE_TTL) {
          emailCache.current.delete(email);
        }
      }
    };

    const interval = setInterval(cleanup, CACHE_TTL);
    return () => clearInterval(interval);
  }, []);

  return {
    isChecking,
    isAvailable,
    error,
    checkEmailAvailability,
  };
}
