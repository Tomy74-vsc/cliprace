'use client';

import { useCallback, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type OptimisticUpdate<T> = (current: T) => T;
type MutationFn = () => Promise<unknown>;
type OnError = (error: Error) => void;
type OnSuccess = () => void;

/**
 * Hook pour gérer les mutations avec optimistic updates
 * 
 * @example
 * const { mutate, isPending, error, data } = useOptimisticMutation({
 *   currentData: items,
 *   optimisticUpdate: (current) => current.map(item => 
 *     item.id === id ? { ...item, status: 'approved' } : item
 *   ),
 *   mutationFn: async () => {
 *     const res = await fetch(`/api/admin/submissions/${id}/approve`, { method: 'POST' });
 *     if (!res.ok) throw new Error('Failed');
 *     return res.json();
 *   },
 *   onSuccess: () => router.refresh(),
 * });
 */
export function useOptimisticMutation<T>({
  currentData,
  optimisticUpdate,
  mutationFn,
  onSuccess,
  onError,
  rollbackOnError = true,
}: {
  currentData: T;
  optimisticUpdate: OptimisticUpdate<T>;
  mutationFn: MutationFn;
  onSuccess?: OnSuccess;
  onError?: OnError;
  rollbackOnError?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<Error | null>(null);
  const [optimisticData, setOptimisticData] = useState<T | null>(null);
  const [previousData, setPreviousData] = useState<T | null>(null);

  const mutate = useCallback(() => {
    // Sauvegarder l'état actuel pour rollback
    if (rollbackOnError) {
      setPreviousData(currentData);
    }

    // Appliquer l'update optimiste immédiatement
    const updated = optimisticUpdate(currentData);
    setOptimisticData(updated);
    setError(null);

    startTransition(async () => {
      try {
        await mutationFn();
        
        // Succès : invalider le cache et rafraîchir
        setOptimisticData(null);
        if (onSuccess) {
          onSuccess();
        } else {
          router.refresh();
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        
        // Rollback si activé
        if (rollbackOnError && previousData !== null) {
          setOptimisticData(previousData);
        } else {
          setOptimisticData(null);
        }
        
        if (onError) {
          onError(error);
        } else {
          console.error('Optimistic mutation failed:', error);
        }
      }
    });
  }, [
    currentData,
    optimisticUpdate,
    mutationFn,
    onSuccess,
    onError,
    rollbackOnError,
    previousData,
    router,
  ]);

  return {
    mutate,
    isPending,
    error,
    data: optimisticData ?? currentData,
  };
}

