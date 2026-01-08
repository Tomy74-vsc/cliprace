/*
Source: Component EligibilityCheck
Purpose: Vérifie l'éligibilité et affiche tooltip avec raison si non éligible
*/
'use client';

import { useEffect, useState } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';

interface EligibilityCheckProps {
  contestId: string;
  children: (eligible: boolean) => React.ReactNode;
  fallback?: React.ReactNode;
}

export function EligibilityCheck({ contestId, children, fallback }: EligibilityCheckProps) {
  const [eligibility, setEligibility] = useState<{ eligible: boolean; reason?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkEligibility() {
      try {
        const response = await fetch(`/api/contests/${contestId}/eligibility`);
        const data = await response.json();
        setEligibility(data);
      } catch (error) {
        setEligibility({ eligible: false, reason: 'Erreur lors de la vérification' });
      } finally {
        setIsLoading(false);
      }
    }

    checkEligibility();
  }, [contestId]);

  if (isLoading) {
    return <Skeleton className="h-10 w-full" />;
  }

  if (!eligibility) {
    return fallback || null;
  }

  if (!eligibility.eligible) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="w-full cursor-not-allowed">
              {children(false)}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs bg-zinc-950 dark:bg-zinc-900 border-zinc-800 text-white">
            <p className="font-medium mb-1">Participation non disponible</p>
            <p className="text-xs text-zinc-300">{eligibility.reason}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return <>{children(true)}</>;
}

