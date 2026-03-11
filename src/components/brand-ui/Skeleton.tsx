/**
 * Skeleton — Layout-matching skeleton components.
 * Server component. All use animate-pulse (motion-safe).
 */
import { cn } from '@/lib/utils';

/* ── Shared base ── */

const pulseBase = 'brand-scope bg-[var(--surface-2)] motion-safe:animate-pulse';

/* ── SkeletonLine ── */

export interface SkeletonLineProps {
  width?: string;
  height?: string;
  className?: string;
}

export function SkeletonLine({
  width = '100%',
  height = '14px',
  className,
}: SkeletonLineProps) {
  return (
    <div
      className={cn(pulseBase, 'rounded', className)}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

/* ── SkeletonBlock ── */

export interface SkeletonBlockProps {
  width?: string;
  height?: string;
  rounded?: string;
  className?: string;
}

export function SkeletonBlock({
  width = '100%',
  height = '80px',
  rounded = 'var(--r3)',
  className,
}: SkeletonBlockProps) {
  return (
    <div
      className={cn(pulseBase, className)}
      style={{ width, height, borderRadius: rounded }}
      aria-hidden="true"
    />
  );
}

/* ── SkeletonKpiHero — matches KpiHero layout ── */

export function SkeletonKpiHero({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'brand-scope rounded-[var(--r3)] border border-[var(--border-1)] bg-[var(--surface-1)] p-6 space-y-3',
        '[clip-path:polygon(0_0,calc(100%-16px)_0,100%_16px,100%_100%,0_100%)]',
        className,
      )}
      aria-busy="true"
    >
      <SkeletonLine width="80px" height="12px" />
      <SkeletonLine width="160px" height="48px" />
      <SkeletonLine width="100px" height="12px" />
    </div>
  );
}

/* ── SkeletonKpi — matches Kpi compact layout ── */

export function SkeletonKpi({ className }: { className?: string }) {
  return (
    <div className={cn('brand-scope flex flex-col gap-1', className)} aria-busy="true">
      <SkeletonLine width="96px" height="28px" />
      <SkeletonLine width="64px" height="11px" />
    </div>
  );
}

/* ── SkeletonCard ── */

export interface SkeletonCardProps {
  lines?: number;
  className?: string;
}

export function SkeletonCard({ lines = 3, className }: SkeletonCardProps) {
  return (
    <div
      className={cn(
        'brand-scope rounded-[var(--r3)] border border-[var(--border-1)] bg-[var(--surface-1)] p-4 space-y-3',
        className,
      )}
      aria-busy="true"
    >
      {Array.from({ length: lines }, (_, i) => (
        <SkeletonLine
          key={i}
          width={i === 0 ? '60%' : i === lines - 1 ? '40%' : '80%'}
        />
      ))}
    </div>
  );
}

/* ── SkeletonTable ── */

export interface SkeletonTableProps {
  rows?: number;
  cols?: number;
  className?: string;
}

export function SkeletonTable({
  rows = 5,
  cols = 4,
  className,
}: SkeletonTableProps) {
  return (
    <div className={cn('brand-scope space-y-0', className)} aria-busy="true">
      {/* Header */}
      <div className="flex gap-4 py-3 px-4 bg-[var(--surface-2)] rounded-t-[var(--r3)]">
        {Array.from({ length: cols }, (_, i) => (
          <SkeletonLine key={i} width={`${60 + (i % 3) * 20}px`} height="11px" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }, (_, r) => (
        <div
          key={r}
          className="flex gap-4 py-3 px-4 border-b border-[var(--border-1)] last:border-b-0"
        >
          {Array.from({ length: cols }, (_, c) => (
            <SkeletonLine key={c} width={`${50 + ((r + c) % 4) * 15}px`} height="14px" />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ── SkeletonBrandShell — topbar + content area ── */

export function SkeletonBrandShell({ className }: { className?: string }) {
  return (
    <div className={cn('brand-scope min-h-screen', className)} aria-busy="true">
      {/* Topbar */}
      <div className="h-14 border-b border-[var(--border-1)] bg-[var(--surface-1)] flex items-center px-6 gap-4">
        <SkeletonLine width="100px" height="20px" />
        <SkeletonLine width="200px" height="14px" />
        <div className="flex-1" />
        <SkeletonBlock width="32px" height="32px" rounded="9999px" />
      </div>
      {/* Content */}
      <div className="p-6 space-y-4 max-w-7xl mx-auto">
        <SkeletonLine width="200px" height="28px" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SkeletonKpiHero />
          <SkeletonKpiHero />
          <SkeletonKpiHero />
        </div>
        <SkeletonTable rows={5} cols={4} />
      </div>
    </div>
  );
}

const Skeletons = {
  SkeletonLine,
  SkeletonBlock,
  SkeletonKpiHero,
  SkeletonKpi,
  SkeletonCard,
  SkeletonTable,
  SkeletonBrandShell,
};

export default Skeletons;
