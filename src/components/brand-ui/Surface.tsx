import { forwardRef, type ElementType, type ComponentPropsWithRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/* ── CVA variants ────────────────────────────────────────────────────────── */

export const surfaceVariants = cva(
  [
    'brand-scope relative',
    'rounded-[var(--r3)] border bg-[var(--surface-1)]',
    'border-[var(--border-1)] shadow-[var(--shadow-1)]',
  ].join(' '),
  {
    variants: {
      variant: {
        default: '',
        hoverable: [
          'transition-[border-color,transform]',
          'duration-[var(--motion-normal)]',
          '[transition-timing-function:var(--motion-ease)]',
          'hover:border-[var(--border-2)] hover:-translate-y-px',
          'motion-reduce:hover:translate-y-0',
          'cursor-pointer',
        ].join(' '),
        track: [
          '[background-image:url(/track-pattern.svg)]',
          '[background-size:400px]',
          '[background-repeat:repeat]',
        ].join(' '),
        notched:
          '[clip-path:polygon(0_0,calc(100%-16px)_0,100%_16px,100%_100%,0_100%)]',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

/* ── Types ───────────────────────────────────────────────────────────────── */

type SurfaceOwnProps<T extends ElementType = 'div'> = {
  as?: T;
} & VariantProps<typeof surfaceVariants>;

export type SurfaceProps<T extends ElementType = 'div'> = SurfaceOwnProps<T> &
  Omit<ComponentPropsWithRef<T>, keyof SurfaceOwnProps<T>>;

/* ── Component ───────────────────────────────────────────────────────────── */

function SurfaceInner(
  { as, variant, className, ...rest }: SurfaceProps,
  ref: React.ForwardedRef<HTMLDivElement>,
) {
  const Comp: ElementType = as ?? 'div';
  return (
    <Comp
      ref={ref}
      className={cn(surfaceVariants({ variant }), className)}
      {...rest}
    />
  );
}

export const Surface = forwardRef(SurfaceInner);
Surface.displayName = 'Surface';

export default Surface;
