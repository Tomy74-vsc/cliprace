'use client';

/**
 * KpiHero — Animated KPI display for brand dashboards.
 * Client component (wraps @number-flow/react).
 *
 * Features:
 * - Animated number transitions via NumberFlow
 * - tabular-nums for alignment
 * - SSR fallback: renders static value
 * - Loading skeleton state
 * - Optional delta indicator (up/down)
 */
import { Suspense } from 'react';
import NumberFlow from '@number-flow/react';
import { cn } from '@/lib/utils';

export interface KpiHeroProps {
  /** The numeric value to display */
  value: number;
  /** Label under the number */
  label: string;
  /** Delta percentage (positive = up, negative = down) */
  delta?: number;
  /** Prefix before number (e.g. "$", "€") */
  prefix?: string;
  /** Suffix after number (e.g. "%", "views") */
  suffix?: string;
  /** Show loading skeleton */
  loading?: boolean;
  /** Additional className */
  className?: string;
}

export function KpiHero({
  value,
  label,
  delta,
  prefix,
  suffix,
  loading = false,
  className,
}: KpiHeroProps) {
  if (loading) {
    return (
      <div className={cn('space-y-2', className)} aria-busy="true">
        <div className="h-12 w-32 rounded-lg bg-[var(--surface-2)] animate-pulse" />
        <div className="h-4 w-20 rounded bg-[var(--surface-2)] animate-pulse" />
      </div>
    );
  }

  return (
    <div className={cn('space-y-1', className)}>
      {/* ── Number row ── */}
      <div className="flex items-baseline gap-1.5">
        {prefix && (
          <span className="text-2xl font-semibold text-[var(--text-2)] brand-tracking">
            {prefix}
          </span>
        )}

        <Suspense
          fallback={
            <span className="text-5xl font-semibold brand-tabular brand-tracking-tight text-[var(--text-1)]">
              {value.toLocaleString('fr-FR')}
            </span>
          }
        >
          <NumberFlow
            value={value}
            className="text-5xl font-semibold brand-tracking-tight text-[var(--text-1)]"
            style={{ fontVariantNumeric: 'tabular-nums' }}
            locales="fr-FR"
          />
        </Suspense>

        {suffix && (
          <span className="text-lg font-medium text-[var(--text-3)] ml-1">
            {suffix}
          </span>
        )}
      </div>

      {/* ── Label row ── */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">
          {label}
        </span>

        {delta !== undefined && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium',
              delta >= 0
                ? 'bg-[var(--accent-soft)] text-[var(--brand-accent)]'
                : 'bg-red-500/10 text-[var(--brand-danger)]',
            )}
            aria-label={`${delta >= 0 ? 'Hausse' : 'Baisse'} de ${Math.abs(delta)}%`}
          >
            <svg
              className={cn('h-3 w-3', delta < 0 && 'rotate-180')}
              viewBox="0 0 12 12"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M6 2.5v7M6 2.5L3 5.5M6 2.5l3 3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {Math.abs(delta)}%
          </span>
        )}
      </div>
    </div>
  );
}
