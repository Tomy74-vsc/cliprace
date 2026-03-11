'use client';

/**
 * ErrorState — Error placeholder with retry action.
 * Client component (onClick handler for retry).
 */
import { useState, type ReactNode } from 'react';
import { AlertCircle, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

/* ── Types ── */

export interface ErrorStateProps {
  title?: string;
  description?: string;
  /** string → Link href | function → button onClick. */
  retry?: string | (() => void);
  /** Error detail for debug toggle. */
  error?: Error | string;
  /** Override icon slot. */
  icon?: ReactNode;
  className?: string;
}

/* ── Component ── */

export function ErrorState({
  title = 'Something went wrong',
  description = 'An error occurred. Please try again.',
  retry,
  error,
  icon,
  className,
}: ErrorStateProps) {
  const [showDetail, setShowDetail] = useState(false);
  const errorMessage =
    error instanceof Error ? error.message : typeof error === 'string' ? error : null;

  return (
    <div
      className={cn(
        'brand-scope flex flex-col items-center justify-center gap-4 py-12 px-6 text-center',
        className,
      )}
    >
      {/* Icon */}
      <div className="text-[var(--brand-danger)]">
        {icon ?? <AlertCircle className="h-10 w-10" strokeWidth={1.5} />}
      </div>

      {/* Text */}
      <div className="space-y-1.5">
        <h3 className="text-[16px] font-semibold text-[var(--text-1)]">
          {title}
        </h3>
        <p className="text-[14px] text-[var(--text-3)] max-w-sm mx-auto leading-relaxed">
          {description}
        </p>
      </div>

      {/* Retry */}
      {retry && (
        <div className="mt-2">
          {typeof retry === 'string' ? (
            <Link
              href={retry}
              className={cn(
                'inline-flex items-center justify-center rounded-[var(--r2)] px-5 py-2.5',
                'bg-[var(--cta-bg)] text-[var(--cta-fg)]',
                'text-sm font-semibold',
                'hover:bg-white/90 transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50',
                'focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-void)]',
              )}
            >
              Retry
            </Link>
          ) : (
            <button
              type="button"
              onClick={retry}
              className={cn(
                'inline-flex items-center justify-center rounded-[var(--r2)] px-5 py-2.5',
                'bg-[var(--cta-bg)] text-[var(--cta-fg)]',
                'text-sm font-semibold',
                'hover:bg-white/90 transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50',
                'focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-void)]',
              )}
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Error detail toggle */}
      {errorMessage && (
        <div className="mt-2 w-full max-w-md">
          <button
            type="button"
            onClick={() => setShowDetail((s) => !s)}
            className="inline-flex items-center gap-1 text-[12px] text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors"
          >
            <ChevronDown
              className={cn(
                'h-3 w-3 transition-transform',
                showDetail && 'rotate-180',
              )}
            />
            Details
          </button>
          {showDetail && (
            <pre className="mt-2 rounded-[var(--r2)] bg-[var(--surface-3)] p-3 text-left text-[11px] text-[var(--text-3)] font-mono overflow-x-auto whitespace-pre-wrap break-words">
              {errorMessage}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

export default ErrorState;
