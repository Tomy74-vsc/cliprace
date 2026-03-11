/**
 * StatusBadge — Pill badge with dot indicator.
 * Server component. CVA-based.
 *
 * Accepts either a status prop (auto color + label) or explicit variant + label.
 */
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/* ── CVA ── */

const statusBadgeVariants = cva(
  'brand-scope inline-flex items-center gap-1.5 rounded-[var(--r-pill)] px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap',
  {
    variants: {
      variant: {
        success: 'bg-[var(--brand-accent)]/12 text-[var(--brand-accent)]',
        warning: 'bg-[var(--brand-warning)]/12 text-[var(--brand-warning)]',
        danger: 'bg-[var(--brand-danger)]/12 text-[var(--brand-danger)]',
        neutral: 'bg-[var(--text-3)]/12 text-[var(--text-2)]',
        muted: 'bg-[var(--text-3)]/8 text-[var(--text-3)]',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
);

export { statusBadgeVariants };

/* ── Status type map ── */

export type StatusKey =
  | 'active'
  | 'draft'
  | 'paused'
  | 'ended'
  | 'archived'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'live'
  | 'success'
  | 'warning'
  | 'danger'
  | 'neutral';

const STATUS_CONFIG: Record<
  StatusKey,
  { variant: NonNullable<VariantProps<typeof statusBadgeVariants>['variant']>; label: string; pulse: boolean }
> = {
  active: { variant: 'success', label: 'Live', pulse: true },
  live: { variant: 'success', label: 'Live', pulse: true },
  approved: { variant: 'success', label: 'Approuvé', pulse: false },
  success: { variant: 'success', label: 'Succès', pulse: false },
  draft: { variant: 'neutral', label: 'Brouillon', pulse: false },
  neutral: { variant: 'neutral', label: '—', pulse: false },
  pending: { variant: 'neutral', label: 'En attente', pulse: false },
  paused: { variant: 'warning', label: 'En pause', pulse: false },
  warning: { variant: 'warning', label: 'Attention', pulse: false },
  ended: { variant: 'muted', label: 'Terminé', pulse: false },
  archived: { variant: 'muted', label: 'Archivé', pulse: false },
  rejected: { variant: 'danger', label: 'Rejeté', pulse: false },
  danger: { variant: 'danger', label: 'Erreur', pulse: false },
};

/* ── Props ── */

export interface StatusBadgeProps extends VariantProps<typeof statusBadgeVariants> {
  /** Status key — auto resolves variant, label, and pulse. */
  status?: StatusKey;
  /** Override the auto-generated label. */
  label?: string;
  /** Pulse the dot (auto for active/live if not set). */
  pulse?: boolean;
  className?: string;
}

/* ── Component ── */

export function StatusBadge({
  status,
  variant: variantProp,
  label: labelProp,
  pulse: pulseProp,
  className,
}: StatusBadgeProps) {
  const config = status ? STATUS_CONFIG[status] : null;
  const variant = variantProp ?? config?.variant ?? 'neutral';
  const label = labelProp ?? config?.label ?? '—';
  const pulse = pulseProp ?? config?.pulse ?? false;

  return (
    <span className={cn(statusBadgeVariants({ variant }), className)}>
      <span
        className={cn(
          'h-[5px] w-[5px] rounded-full bg-current shrink-0',
          pulse && 'motion-safe:animate-pulse',
        )}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

/* ── Helper exports for backward compat ── */

export function contestStatusVariant(
  status: string,
): StatusBadgeProps['variant'] {
  return STATUS_CONFIG[status as StatusKey]?.variant ?? 'neutral';
}

export function contestStatusLabel(status: string): string {
  return STATUS_CONFIG[status as StatusKey]?.label ?? status;
}

export default StatusBadge;
