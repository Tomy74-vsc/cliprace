// Source: Design System — Buttons (§32, §1274)
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ring-offset-background disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-card hover:bg-primary/90 focus-visible:ring-primary',
        primary:
          'bg-primary text-primary-foreground shadow-card hover:bg-primary/90 focus-visible:ring-primary',
        outline:
          'border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80 focus-visible:ring-primary',
        secondary:
          'border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80 focus-visible:ring-primary',
        ghost:
          'hover:bg-muted text-foreground focus-visible:ring-primary/60',
        warning:
          'bg-warning text-warning-foreground shadow-[0_10px_25px_-10px_rgba(245,158,11,0.35)] hover:bg-warning/90 focus-visible:ring-warning',
        destructive:
          'bg-destructive text-destructive-foreground shadow-[0_10px_25px_-10px_rgba(244,63,94,0.35)] hover:bg-destructive/90 focus-visible:ring-destructive',
      },
      size: {
        sm: 'px-4 py-2 text-sm',
        md: 'px-6 py-3 text-base',
        lg: 'px-8 py-4 text-lg',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, children, disabled, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';

    const sharedProps = {
      className: cn(buttonVariants({ variant, size, className })),
      ...props,
    };

    if (asChild) {
      // When using asChild, we delegate element type to the child.
      // We ne gérons pas l'état `loading` ici pour éviter de passer des props à un Fragment.
      return (
        <Comp {...sharedProps} ref={ref as UnsafeAny}>
          {children}
        </Comp>
      );
    }

    const content = (
      <>
        {loading && (
          <svg
            className="h-4 w-4 animate-spin"
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
        )}
        {children}
      </>
    );

    return (
      <Comp {...sharedProps} ref={ref} disabled={disabled || loading}>
        {content}
      </Comp>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };


