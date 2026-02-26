/**
 * StatusBadge — Pill badge with dot indicator for status display.
 * Server component. Uses CVA for variant-based styling.
 *
 * Variants: success (live), warning (ended/pending), danger, neutral (draft), muted (archived)
 * Features:
 * - Dot indicator with optional pulse (motion-safe only)
 * - Pill shape (r-pill)
 * - Ink Dark token colors
 */
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const statusBadgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-[var(--r-pill)] px-2.5 py-1 text-xs font-medium whitespace-nowrap',
  {
    variants: {
      variant: {
        success:
          'bg-[var(--brand-success)]/12 text-[var(--brand-success)]',
        warning:
          'bg-[var(--brand-warning)]/12 text-[var(--brand-warning)]',
        danger:
          'bg-[var(--brand-danger)]/12 text-[var(--brand-danger)]',
        neutral:
          'bg-[var(--text-3)]/12 text-[var(--text-2)]',
        muted:
          'bg-[var(--text-3)]/8 text-[var(--text-3)]',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  },
);

export interface StatusBadgeProps
  extends VariantProps<typeof statusBadgeVariants> {
  /** Display label */
  label: string;
  /** Pulse the dot indicator (respects prefers-reduced-motion) */
  pulse?: boolean;
  className?: string;
}

export function StatusBadge({
  variant,
  label,
  pulse = false,
  className,
}: StatusBadgeProps) {
  return (
    <span className={cn(statusBadgeVariants({ variant }), className)}>
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full bg-current shrink-0',
          pulse && 'motion-safe:animate-pulse',
        )}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

/* ── Contest status helpers ── */

export function contestStatusVariant(
  status: string,
): StatusBadgeProps['variant'] {
  switch (status) {
    case 'active':
      return 'success';
    case 'draft':
      return 'neutral';
    case 'ended':
      return 'warning';
    case 'archived':
      return 'muted';
    default:
      return 'neutral';
  }
}

export function contestStatusLabel(status: string): string {
  switch (status) {
    case 'active':
      return 'Live';
    case 'draft':
      return 'Brouillon';
    case 'ended':
      return 'Terminé';
    case 'archived':
      return 'Archivé';
    default:
      return status;
  }
}
