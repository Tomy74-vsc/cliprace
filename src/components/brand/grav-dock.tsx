'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Inbox, Layers, LayoutDashboard, Settings, Users } from 'lucide-react';
import type { ComponentType } from 'react';
import { useCallback, useState } from 'react';

import { cn } from '@/lib/utils';

type DockItem = {
  key: 'dashboard' | 'campaigns' | 'moderation' | 'creators' | 'settings';
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
};

const dock: DockItem[] = [
  { key: 'dashboard', label: 'Tableau de bord', href: '/app/brand/dashboard', icon: LayoutDashboard },
  { key: 'campaigns', label: 'Campagnes', href: '/app/brand/contests', icon: Layers },
  { key: 'moderation', label: 'Modération', href: '/app/brand/moderation', icon: Inbox },
  { key: 'creators', label: 'Créateurs', href: '/app/brand/creators', icon: Users },
  { key: 'settings', label: 'Paramètres', href: '/app/brand/settings', icon: Settings },
];

export function GravDock() {
  const pathname = usePathname();
  const moderationContext = pathname.includes('/submissions');
  const [expanded, setExpanded] = useState(false);

  const expand = useCallback(() => setExpanded(true), []);
  const collapse = useCallback(() => setExpanded(false), []);

  return (
    <motion.nav
      className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50"
      initial={{ opacity: 0, y: 12, filter: 'blur(10px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ type: 'spring', stiffness: 220, damping: 22 }}
      aria-label="Navigation marque"
      onPointerEnter={expand}
      onPointerLeave={collapse}
      onFocusCapture={expand}
      onBlurCapture={collapse}
    >
      <div
        className={cn(
          'group rounded-full bg-zinc-950/80 backdrop-blur-3xl border border-white/10 shadow-[0_20px_40px_rgba(0,0,0,0.5)] ring-1 ring-inset ring-white/5',
          'transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)]',
          expanded ? 'px-3 py-2' : 'p-2'
        )}
      >
        <div className={cn('flex items-center', expanded ? 'gap-2' : 'gap-1')}>
        {dock.map((item) => {
          const active =
            item.key === 'moderation'
              ? moderationContext || pathname.startsWith(item.href)
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex items-center rounded-full text-zinc-400',
                'transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)]',
                expanded ? 'h-12 px-4' : 'size-11 justify-center',
                'hover:text-white hover:bg-white/10 hover:scale-110',
                active && 'text-white bg-white/10'
              )}
              title={item.label}
            >
              <Icon className="h-5 w-5" />
              <span
                className={cn(
                  'ml-3 whitespace-nowrap text-sm font-medium tracking-tight text-white/90',
                  'transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)]',
                  expanded ? 'opacity-100 max-w-40' : 'opacity-0 max-w-0',
                  'overflow-hidden'
                )}
              >
                {item.label}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  'absolute -bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-white/80 opacity-0 transition-opacity duration-200',
                  active && 'opacity-100'
                )}
              />
              <span className="sr-only">{item.label}</span>
            </Link>
          );
        })}
        </div>
      </div>
    </motion.nav>
  );
}
