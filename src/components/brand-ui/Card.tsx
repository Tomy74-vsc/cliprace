import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';
import { Surface } from './Surface';

/* ── Types ───────────────────────────────────────────────────────────────── */

export interface CardProps extends ComponentPropsWithoutRef<'div'> {
  /** Activate hover lift effect (auto-enabled if onClick provided). */
  hoverable?: boolean;
}

/* ── Component ───────────────────────────────────────────────────────────── */

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ hoverable, onClick, className, children, ...rest }, ref) => {
    const isHoverable = hoverable ?? !!onClick;

    return (
      <Surface
        ref={ref}
        variant={isHoverable ? 'hoverable' : 'default'}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={
          onClick
            ? (e: React.KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onClick(e as unknown as React.MouseEvent<HTMLDivElement>);
                }
              }
            : undefined
        }
        className={cn('p-4', className)}
        {...rest}
      >
        {children}
      </Surface>
    );
  },
);

Card.displayName = 'Card';

export default Card;
