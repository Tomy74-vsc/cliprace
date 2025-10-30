/**
 * Composant Button optimisé avec animations et accessibilité
 */

import { forwardRef, useCallback } from 'react';
import { useAnimation, AnimationConfig } from '@/lib/animations';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  animation?: Partial<AnimationConfig>;
  fullWidth?: boolean;
  asChild?: boolean;
  children: React.ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      icon,
      iconPosition = 'left',
      animation,
      fullWidth = false,
      asChild = false,
      className = '',
      disabled,
      children,
      onClick,
      ...props
    },
    ref
  ) => {
    const { isAnimating, animationClass, startAnimation } = useAnimation(animation);
    
    const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
      if (!loading && !disabled) {
        startAnimation();
        onClick?.(e);
      }
    }, [loading, disabled, onClick, startAnimation]);
    
  const baseClasses = 'btn relative overflow-hidden group';
  const variantClasses = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    ghost: 'btn-ghost',
    outline: 'btn-secondary border-2',
  };
  const sizeClasses = {
    sm: 'px-6 py-3 text-sm',
    md: 'px-8 py-4 text-base',
    lg: 'px-10 py-5 text-lg',
  };
    
    const classes = [
      baseClasses,
      variantClasses[variant],
      sizeClasses[size],
      fullWidth && 'w-full',
      loading && 'cursor-not-allowed opacity-75',
      disabled && 'cursor-not-allowed opacity-50',
      animationClass,
      className,
    ].filter(Boolean).join(' ');
    
    return (
      <button
        ref={ref}
        className={classes}
        disabled={disabled || loading}
        onClick={handleClick}
        aria-disabled={disabled || loading}
        {...props}
      >
        {/* Ripple effect premium */}
        <span className="absolute inset-0 overflow-hidden rounded-2xl">
          <span className="absolute inset-0 bg-gradient-to-r from-white/20 to-white/10 scale-0 transition-transform duration-500 group-hover:scale-100" />
        </span>
        
        {/* Shimmer effect */}
        <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 transform -skew-x-12 translate-x-full group-hover:translate-x-[-100%]"></span>
        
        {/* Content */}
        <span className="relative flex items-center justify-center gap-2">
          {loading ? (
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          ) : (
            <>
              {icon && iconPosition === 'left' && (
                <span className="flex-shrink-0">{icon}</span>
              )}
              <span>{children}</span>
              {icon && iconPosition === 'right' && (
                <span className="flex-shrink-0">{icon}</span>
              )}
            </>
          )}
        </span>
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };
