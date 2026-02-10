/* Navigation créateur : sidebar (curseur glissant) + export pour bottom nav */
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Bell, Home, Trophy, User, Video, Wallet2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export const iconMap = {
  home: Home,
  trophy: Trophy,
  video: Video,
  wallet: Wallet2,
  user: User,
  bell: Bell,
} as const;

export type IconKey = keyof typeof iconMap;

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

  /* Bottom variant: délégué à CreatorBottomNav pour le style pill glass */
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
              aria-current={active ? 'page' : undefined}
              className={cn(
                'group relative flex flex-col items-center justify-center py-2.5 text-[11px] font-medium transition-colors duration-200',
                active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon
                className={cn(
                  'h-5 w-5 transition-transform duration-200 motion-safe:will-change-transform',
                  active ? 'scale-110' : 'group-hover:scale-105'
                )}
              />
              <span className="mt-1">{item.label}</span>
              {item.badgeCount ? (
                <span className="absolute -top-1.5 right-[22%] rounded-full bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 leading-none shadow-sm">
                  {item.badgeCount > 9 ? '9+' : item.badgeCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    );
  }

  /* Sidebar : style aérien + curseur glissant (layout animation) */
  return (
    <TooltipProvider delayDuration={200}>
      <nav className="relative space-y-0.5">
        {nav.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = iconMap[item.icon];
          const linkContent = (
            <Link
              href={item.href}
              className={cn(
                'relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200',
                active ? 'text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
              )}
            >
              {active && (
                <motion.div
                  layoutId="creator-sidebar-active"
                  className="absolute inset-0 rounded-xl bg-primary/10 ring-1 ring-primary/20"
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  aria-hidden
                />
              )}
              <span className="relative flex h-8 w-8 shrink-0 items-center justify-center">
                <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} />
                {item.badgeCount ? (
                  <span className="absolute -top-1 -right-1 rounded-full bg-primary text-primary-foreground text-[10px] min-w-[14px] h-[14px] flex items-center justify-center px-1">
                    {item.badgeCount > 9 ? '9+' : item.badgeCount}
                  </span>
                ) : null}
              </span>
              <span className="relative truncate">{item.label}</span>
            </Link>
          );

          if (!item.tooltip) {
            return <div key={item.href}>{linkContent}</div>;
          }
          return (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>
                <div>{linkContent}</div>
              </TooltipTrigger>
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
