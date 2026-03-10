'use client';

/**
 * AnalyticsPeriodToggle — Segmented control for analytics period (7j / 30j).
 * Purely visual for now. Does not change data fetch. Ready to wire later.
 */
import { useState } from 'react';
import { cn } from '@/lib/utils';

const periods = [
  { key: '7d', label: '7 jours' },
  { key: '30d', label: '30 jours' },
] as const;

export function AnalyticsPeriodToggle() {
  const [selected, setSelected] = useState<'7d' | '30d'>('7d');

  return (
    <div
      className="inline-flex rounded-[var(--r2)] border border-[var(--border-1)] p-0.5"
      role="tablist"
      aria-label="Période d'analyse"
    >
      {periods.map((p) => (
        <button
          key={p.key}
          type="button"
          role="tab"
          {...(selected === p.key ? { 'aria-selected': 'true' as const } : {})}
          onClick={() => setSelected(p.key)}
          className={cn(
            'rounded-[8px] px-3 py-1 text-xs font-medium transition-colors',
            selected === p.key
              ? 'bg-[var(--surface-2)] text-[var(--text-1)]'
              : 'text-[var(--text-3)] hover:text-[var(--text-2)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)]',
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
