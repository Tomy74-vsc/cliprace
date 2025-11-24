/* Navigation créateur (sidebar + bottom nav mobile) */
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export function CreatorNav({
  nav,
  variant = 'sidebar',
}: {
  nav: NavItem[];
  variant?: 'sidebar' | 'bottom';
}) {
  const pathname = usePathname();

  if (variant === 'bottom') {
    return (
      <div className="grid grid-cols-5">
        {nav.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center py-2 text-xs font-medium transition-colors',
                active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="mt-1">{item.label}</span>
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <nav className="space-y-1">
      {nav.map((item) => {
        const active = pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
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
            <Icon className="h-5 w-5" />
            <span className="font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
