'use client';

/**
 * Kpi — Compact KPI for horizontal strip.
 * Client component (NumberFlow).
 */
import { Suspense } from 'react';
import NumberFlow from '@number-flow/react';
import { cn } from '@/lib/utils';

/* ── Types ── */

export type KpiTrend = 'up' | 'down' | 'neutral';

export interface KpiProps {
  label: string;
  value: number;
  unit?: string;
  delta?: number;
  format?: 'number' | 'currency' | 'percent';
  trend?: KpiTrend;
  className?: string;
}

/* ── Component ── */

export function Kpi({
  label,
  value,
  unit,
  delta,
  format = 'number',
  trend,
  className,
}: KpiProps) {
  const effectiveTrend = trend ?? (delta !== undefined ? (delta >= 0 ? 'up' : 'down') : 'neutral');

  return (
    <div className={cn('brand-scope flex flex-col gap-0.5', className)}>
      {/* Value */}
      <div className="flex items-baseline gap-1">
        {format === 'number' ? (
          <Suspense
            fallback={
              <span className="text-[28px] font-semibold brand-tabular brand-tracking-tight text-[var(--text-1)] leading-tight">
                {value.toLocaleString('fr-FR')}
              </span>
            }
          >
            <NumberFlow
              value={value}
              className="text-[28px] font-semibold brand-tracking-tight text-[var(--text-1)] leading-tight"
              style={{ fontVariantNumeric: 'tabular-nums' }}
              locales="fr-FR"
            />
          </Suspense>
        ) : (
          <span className="text-[28px] font-semibold brand-tabular brand-tracking-tight text-[var(--text-1)] leading-tight">
            {format === 'currency'
              ? new Intl.NumberFormat('fr-FR', {
                  style: 'currency',
                  currency: 'EUR',
                  maximumFractionDigits: 0,
                }).format(value)
              : `${value}%`}
          </span>
        )}

        {unit && (
          <span className="text-sm text-[var(--text-3)]">{unit}</span>
        )}
      </div>

      {/* Label + delta */}
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-medium text-[var(--text-3)] uppercase tracking-wide">
          {label}
        </span>

        {delta !== undefined && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-[11px] font-medium',
              effectiveTrend === 'up' && 'text-[var(--brand-accent)]',
              effectiveTrend === 'down' && 'text-[var(--brand-danger)]',
              effectiveTrend === 'neutral' && 'text-[var(--text-3)]',
            )}
          >
            {effectiveTrend === 'up' && (
              <svg className="h-2.5 w-2.5" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                <path d="M5 1.5v7M5 1.5L2 4.5M5 1.5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            {effectiveTrend === 'down' && (
              <svg className="h-2.5 w-2.5 rotate-180" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                <path d="M5 1.5v7M5 1.5L2 4.5M5 1.5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            {delta > 0 ? '+' : ''}
            {delta}%
          </span>
        )}
      </div>
    </div>
  );
}

export default Kpi;
