/**
 * GlassCard — Premium glass surface for brand UI.
 * Server component. Beam effect is CSS-only (no JS animation library).
 *
 * Variants:
 * - variant: default | interactive (hover lift + border brightening)
 * - effect: none | beam (Magic UI border beam — CSS @property animation)
 * - notched: boolean (Clip Notch signature)
 * - pattern: none | track (Track Pattern texture)
 */
import type { ReactNode, HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const glassCardVariants = cva(
  [
    'relative rounded-[var(--r3)] border',
    'bg-[var(--surface-1)]/80 backdrop-blur-xl',
    'shadow-[var(--shadow-brand-1)]',
    'transition-all',
  ].join(' '),
  {
    variants: {
      variant: {
        default: 'border-[var(--border-1)]',
        interactive: [
          'border-[var(--border-1)]',
          'hover:border-[var(--border-2)]',
          'hover:-translate-y-px hover:shadow-[var(--shadow-brand-2)]',
          'cursor-pointer',
        ].join(' '),
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface GlassCardProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof glassCardVariants> {
  /** Border beam effect (Magic UI inspired) — max 1 per screen */
  effect?: 'none' | 'beam';
  /** Clip Notch cut-corner (signature 3) */
  notched?: boolean;
  /** Track Pattern subtle texture (signature 2) */
  pattern?: 'none' | 'track';
  children?: ReactNode;
}

export function GlassCard({
  variant,
  effect = 'none',
  notched = false,
  pattern = 'none',
  className,
  children,
  ...props
}: GlassCardProps) {
  // Beam wraps the card in an extra container for the border animation
  if (effect === 'beam') {
    return (
      <div
        className={cn(
          'beam-border relative rounded-[var(--r3)]',
          notched && 'clip-notch',
        )}
        {...props}
      >
        <div
          className={cn(
            glassCardVariants({ variant }),
            pattern === 'track' && 'track-pattern',
            'p-6',
            className,
          )}
        >
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        glassCardVariants({ variant }),
        notched && 'clip-notch',
        pattern === 'track' && 'track-pattern',
        'p-6',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
