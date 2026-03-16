import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const cardVariants = cva(
  'brand-scope rounded-[var(--r3)] border transition-all duration-[180ms] p-4',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--surface-1)] border-[var(--border-1)] shadow-[var(--shadow-1)]',
        hoverable:
          'bg-[var(--surface-1)] border-[var(--border-1)] hover:border-[var(--border-2)] hover:-translate-y-px cursor-pointer',
        track:
          'bg-[var(--surface-1)] border-[var(--border-1)] [background-image:url(/track-pattern.svg)] [background-size:400px]',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(cardVariants({ variant }), className)}
        {...props}
      />
    );
  },
);

Card.displayName = 'Card';

export default Card;
