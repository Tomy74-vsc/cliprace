'use client';

import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button, type ButtonProps } from '@/components/ui/button';

type AdminSmoothButtonProps = ButtonProps & {
  ripple?: boolean;
  glow?: boolean;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
};

/**
 * Button avec micro-interactions premium
 * - Ripple effect au clic
- Glow effect pour actions importantes
- Transitions fluides
 */
export function AdminSmoothButton({
  children,
  className,
  ripple = true,
  glow = false,
  icon,
  iconPosition = 'left',
  variant = 'default',
  ...props
}: AdminSmoothButtonProps) {
  return (
    <Button
      className={cn(
        'relative overflow-hidden',
        'transition-all duration-200',
        'active:scale-95',
        glow && 'shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30',
        variant === 'default' && 'bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary',
        className
      )}
      variant={variant}
      {...props}
    >
      {icon && iconPosition === 'left' && <span className="mr-2">{icon}</span>}
      <span className="relative z-10">{children}</span>
      {icon && iconPosition === 'right' && <span className="ml-2">{icon}</span>}
      {ripple && (
        <span
          className={cn(
            'absolute inset-0 rounded-md',
            'bg-white/20',
            'scale-0 opacity-0',
            'transition-all duration-500',
            'pointer-events-none'
          )}
          style={{
            animation: 'ripple 0.6s ease-out',
          }}
        />
      )}
      <style jsx>{`
        @keyframes ripple {
          to {
            transform: scale(4);
            opacity: 0;
          }
        }
      `}</style>
    </Button>
  );
}


