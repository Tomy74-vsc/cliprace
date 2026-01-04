'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export function AdminHelpButton() {
  const pathname = usePathname();
  const href = `/app/admin/guide?route=${encodeURIComponent(pathname)}`;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button asChild variant="ghost" size="sm" className="h-12 w-12 rounded-full">
            <Link href={href} aria-label="Ouvrir le guide admin">
              <HelpCircle className="h-5 w-5" />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          Guide Admin (aide contextuelle)
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

