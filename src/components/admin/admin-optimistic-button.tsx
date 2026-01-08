'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button, type ButtonProps } from '@/components/ui/button';
import { useToastContext } from '@/hooks/use-toast-context';

type OptimisticButtonProps = Omit<ButtonProps, 'onClick' | 'loading'> & {
  onClick: () => Promise<void>;
  optimisticLabel?: string;
  successMessage?: string;
  errorMessage?: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  refreshOnSuccess?: boolean;
};

/**
 * Bouton avec optimistic update : affiche immédiatement l'état de chargement
 * et rafraîchit les données après succès
 */
export function AdminOptimisticButton({
  onClick,
  optimisticLabel,
  successMessage,
  errorMessage,
  onSuccess,
  onError,
  refreshOnSuccess = true,
  children,
  disabled,
  ...props
}: OptimisticButtonProps) {
  const router = useRouter();
  const { toast } = useToastContext();
  const [isPending, startTransition] = useTransition();
  const [localDisabled, setLocalDisabled] = useState(false);

  const handleClick = () => {
    if (disabled || localDisabled || isPending) return;

    setLocalDisabled(true);
    startTransition(async () => {
      try {
        await onClick();
        
        if (successMessage) {
          toast({
            type: 'success',
            title: 'Succès',
            message: successMessage,
          });
        }
        
        if (onSuccess) {
          onSuccess();
        }
        
        if (refreshOnSuccess) {
          router.refresh();
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Erreur inconnue');
        
        if (errorMessage) {
          toast({
            type: 'error',
            title: 'Erreur',
            message: errorMessage,
          });
        }
        
        if (onError) {
          onError(err);
        } else {
          console.error('Action failed:', err);
        }
      } finally {
        setLocalDisabled(false);
      }
    });
  };

  return (
    <Button
      {...props}
      onClick={handleClick}
      loading={isPending || localDisabled}
      disabled={disabled || localDisabled || isPending}
    >
      {isPending && optimisticLabel ? optimisticLabel : children}
    </Button>
  );
}

