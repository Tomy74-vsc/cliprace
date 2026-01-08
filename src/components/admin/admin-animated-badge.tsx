'use client';

import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Badge, type BadgeProps } from '@/components/ui/badge';

type AdminAnimatedBadgeProps = BadgeProps & {
  pulse?: boolean;
  icon?: ReactNode;
  count?: number;
  showZero?: boolean;
};

/**
 * Badge avec animations et icônes
 * - Pulse animation pour badges importants
- Support des icônes
- Formatage des nombres
 */
export function AdminAnimatedBadge({
  children,
  className,
  pulse = false,
  icon,
  count,
  showZero = false,
  variant,
  ...props
}: AdminAnimatedBadgeProps) {
  const displayCount = count !== undefined ? (count > 0 || showZero ? count : null) : null;

  return (
    <Badge
      className={cn(
        'inline-flex items-center gap-1.5',
        'transition-all duration-200',
        pulse && 'animate-pulse',
        variant === 'danger' && pulse && 'animate-pulse',
        className
      )}
      variant={variant}
      {...props}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {displayCount !== null ? (
        <span className="font-semibold">
          {displayCount > 99 ? '99+' : displayCount.toLocaleString()}
        </span>
      ) : (
        children
      )}
    </Badge>
  );
}


