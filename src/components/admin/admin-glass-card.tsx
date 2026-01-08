'use client';

import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type AdminGlassCardProps = {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  gradient?: boolean;
  padding?: 'sm' | 'md' | 'lg';
};

/**
 * Card avec effet glassmorphism premium
 * Utilise backdrop-blur, bordures subtiles, et ombres douces
 */
export function AdminGlassCard({
  children,
  className,
  hover = false,
  gradient = false,
  padding = 'md',
}: AdminGlassCardProps) {
  const paddingClasses = {
    sm: 'p-4',
    md: 'p-5',
    lg: 'p-6',
  };

  return (
    <div
      className={cn(
        'relative rounded-3xl border border-border/50',
        'bg-card/80 backdrop-blur-xl',
        'shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)]',
        'dark:shadow-[0_4px_6px_-1px_rgba(0,0,0,0.3),0_2px_4px_-1px_rgba(0,0,0,0.2)]',
        gradient && 'bg-gradient-to-br from-card/90 via-card/80 to-card/70',
        hover && 'transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-border',
        paddingClasses[padding],
        className
      )}
    >
      {children}
    </div>
  );
}


