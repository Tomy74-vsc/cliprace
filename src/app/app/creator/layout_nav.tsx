/* Navigation créateur (sidebar + bottom nav mobile) */
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, Home, Trophy, User, Video, Wallet2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const iconMap = {
  home: Home,
  trophy: Trophy,
  video: Video,
  wallet: Wallet2,
  user: User,
  bell: Bell,
} as const;

type IconKey = keyof typeof iconMap;

export type CreatorNavItem = {
  label: string;
  href: string;
  icon: IconKey;
  badgeCount?: number;
  tooltip?: string;
};

export function CreatorNav({
  nav,
  variant = 'sidebar',
}: {
  nav: CreatorNavItem[];
  variant?: 'sidebar' | 'bottom';
}) {
  const pathname = usePathname();

  if (variant === 'bottom') {
    return (
      <div className="grid grid-cols-6">
        {nav.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = iconMap[item.icon];
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'relative flex flex-col items-center justify-center py-2 text-xs font-medium transition-all duration-200',
                active ? 'text-primary' : 'text-muted-foreground hover:text-foreground hover:-translate-y-0.5'
              )}
            >
              <Icon className="h-5 w-5" />
              {item.badgeCount ? (
                <span className="absolute -top-1.5 right-[22%] rounded-full bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 leading-none shadow-sm">
                  {item.badgeCount > 9 ? '9+' : item.badgeCount}
                </span>
              ) : null}
              <span className="mt-1">{item.label}</span>
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <nav className="space-y-1">
        {nav.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = iconMap[item.icon];
          const content = (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group flex items-center gap-3 px-3 py-2 rounded-lg border border-transparent transition-all',
                active
                  ? 'bg-primary/10 text-primary border-primary/30 shadow-card'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              )}
            >
              <span className={cn('h-8 w-1 rounded-full bg-transparent', active && 'bg-primary')} />
              <div className="relative flex items-center gap-2">
                <Icon className="h-5 w-5" />
                {item.badgeCount ? (
                  <span className="absolute -top-2 -right-3 rounded-full bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 leading-none shadow-sm">
                    {item.badgeCount > 9 ? '9+' : item.badgeCount}
                  </span>
                ) : null}
              </div>
              <span className="font-medium">{item.label}</span>
            </Link>
          );

          if (!item.tooltip) return content;

          return (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>{content}</TooltipTrigger>
              <TooltipContent side="right" className="text-xs">
                {item.tooltip}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </nav>
    </TooltipProvider>
  );
}
