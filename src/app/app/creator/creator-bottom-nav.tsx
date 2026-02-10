'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Bell, Home, Trophy, User, Video, Wallet2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CreatorNavItem } from './layout_nav';

const iconMap = {
  home: Home,
  trophy: Trophy,
  video: Video,
  wallet: Wallet2,
  user: User,
  bell: Bell,
} as const;

export function CreatorBottomNav({ nav }: { nav: CreatorNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav
      className="lg:hidden fixed bottom-4 left-4 right-4 z-40 rounded-full border border-border bg-background/90 dark:border-white/10 dark:bg-black/80 backdrop-blur-xl pb-[env(safe-area-inset-bottom)] pt-3 px-2 shadow-lg"
      aria-label="Navigation principale"
    >
      <div className="grid grid-cols-6 gap-1">
        {nav.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = iconMap[item.icon];
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex flex-col items-center justify-center py-2 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-black/80'
              )}
            >
              {active && (
                <motion.div
                  layoutId="creator-bottom-nav-active"
                  className="absolute inset-0 rounded-xl bg-primary/15 ring-1 ring-primary/25"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative flex flex-col items-center gap-0.5">
                <motion.span
                  animate={{ scale: active ? 1.1 : 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  className={cn(
                    'flex items-center justify-center rounded-full p-1.5',
                    active && 'text-primary [filter:drop-shadow(0_0_6px_hsl(var(--primary)))]'
                  )}
                >
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} />
                </motion.span>
                <span
                  className={cn(
                    'text-[10px] font-medium leading-tight',
                    active ? 'text-primary' : 'text-muted-foreground'
                  )}
                >
                  {item.label}
                </span>
              </span>
              {item.badgeCount ? (
                <span className="absolute top-1 right-1/4 min-w-[14px] h-[14px] rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center px-1">
                  {item.badgeCount > 9 ? '9+' : item.badgeCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
