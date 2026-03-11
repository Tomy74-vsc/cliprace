'use client';

/**
 * KpiHero — Animated hero KPI display.
 * Client component (NumberFlow + optional sparkline).
 *
 * Features:
 * - Animated number via NumberFlow (respects prefers-reduced-motion)
 * - Format: number | currency | percent
 * - Delta badge with optional deltaLabel
 * - Optional sparkline (lazy-loaded recharts)
 * - Surface notched wrapper
 * - tabular-nums
 */
import { Suspense, lazy } from 'react';
import NumberFlow from '@number-flow/react';
import { cn } from '@/lib/utils';
import { Surface } from './Surface';

/* ── Lazy sparkline (recharts) ── */
const SparklineChart = lazy(() => import('./SparklineChart'));

/* ── Types ── */

export type KpiHeroFormat = 'number' | 'currency' | 'percent';

export interface KpiHeroProps {
  /** Label above the value. */
  label: string;
  /** Numeric value (or string for pre-formatted). */
  value: number | string;
  /** Unit suffix (e.g. "views"). */
  unit?: string;
  /** Delta percentage. Positive = green, negative = red. */
  delta?: number;
  /** Text after delta badge (e.g. "vs last week"). */
  deltaLabel?: string;
  /** Number formatting. */
  format?: KpiHeroFormat;
  /** ISO 4217 currency code (default "EUR"). */
  currency?: string;
  /** Mini sparkline data array. */
  sparkline?: number[];
  /** Show beam border (use once per page). */
  beam?: boolean;
  /** Prefix before number (e.g. "$", "€") — legacy compat. */
  prefix?: string;
  /** Suffix after number (e.g. "%", "views") — legacy compat. */
  suffix?: string;
  /** Show loading skeleton. */
  loading?: boolean;
  className?: string;
}

/* ── Formatting ── */

function formatValue(
  value: number | string,
  format: KpiHeroFormat,
  currency: string,
): string {
  if (typeof value === 'string') return value;
  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      }).format(value);
    case 'percent':
      return `${value}%`;
    default:
      return value.toLocaleString('fr-FR');
  }
}

/* ── Component ── */

export function KpiHero({
  label,
  value,
  unit,
  delta,
  deltaLabel,
  format = 'number',
  currency = 'EUR',
  sparkline,
  beam = false,
  prefix,
  suffix,
  loading = false,
  className,
}: KpiHeroProps) {
  if (loading) {
    return (
      <Surface
        variant="notched"
        className={cn('p-6 space-y-3', beam && 'beam-border', className)}
        aria-busy="true"
      >
        <div className="h-3 w-20 rounded bg-[var(--surface-2)] animate-pulse" />
        <div className="h-12 w-36 rounded-lg bg-[var(--surface-2)] animate-pulse" />
        <div className="h-3 w-16 rounded bg-[var(--surface-2)] animate-pulse" />
      </Surface>
    );
  }

  const numericValue = typeof value === 'number' ? value : undefined;
  const displayUnit = unit ?? suffix;

  return (
    <Surface
      variant="notched"
      className={cn('p-6', beam && 'beam-border', className)}
    >
      {/* Label */}
      <span className="block text-[12px] font-medium uppercase tracking-wide text-[var(--text-3)]">
        {label}
      </span>

      {/* Value row */}
      <div className="mt-1 flex items-baseline gap-1.5">
        {prefix && (
          <span className="text-2xl font-semibold text-[var(--text-2)] brand-tracking">
            {prefix}
          </span>
        )}

        {numericValue !== undefined && format === 'number' ? (
          <Suspense
            fallback={
              <span className="text-[48px] font-semibold brand-tabular brand-tracking-tight text-[var(--text-1)] leading-none">
                {formatValue(numericValue, format, currency)}
              </span>
            }
          >
            <NumberFlow
              value={numericValue}
              className="text-[48px] font-semibold brand-tracking-tight text-[var(--text-1)] leading-none"
              style={{ fontVariantNumeric: 'tabular-nums' }}
              locales="fr-FR"
            />
          </Suspense>
        ) : (
          <span className="text-[48px] font-semibold brand-tabular brand-tracking-tight text-[var(--text-1)] leading-none">
            {typeof value === 'number'
              ? formatValue(value, format, currency)
              : value}
          </span>
        )}

        {displayUnit && (
          <span className="text-lg font-medium text-[var(--text-3)] ml-1">
            {displayUnit}
          </span>
        )}
      </div>

      {/* Delta row */}
      {(delta !== undefined || deltaLabel) && (
        <div className="mt-2 flex items-center gap-2">
          {delta !== undefined && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[12px] font-medium',
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
          {deltaLabel && (
            <span className="text-[12px] text-[var(--text-3)]">
              {deltaLabel}
            </span>
          )}
        </div>
      )}

      {/* Sparkline */}
      {sparkline && sparkline.length > 1 && (
        <div className="mt-3 h-[50px]">
          <Suspense fallback={<div className="h-[50px] w-full" />}>
            <SparklineChart data={sparkline} />
          </Suspense>
        </div>
      )}
    </Surface>
  );
}

export default KpiHero;
