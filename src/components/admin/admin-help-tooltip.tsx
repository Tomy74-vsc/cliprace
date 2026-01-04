'use client';

import type { ReactNode } from 'react';
import { Info } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type AdminHelpTooltipProps = {
  label?: string;
  content: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
};

export function AdminHelpTooltip({
  label = 'Aide',
  content,
  side = 'bottom',
}: AdminHelpTooltipProps) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm" className="h-9 w-9 rounded-full" aria-label={label}>
            <Info className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs text-xs leading-relaxed">
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

