/**
 * BrandInput — Premium input for brand-facing forms.
 * Server component (forwardRef). Compatible with react-hook-form.
 *
 * Features:
 * - Label + optional helper text + error state
 * - Race Light focus ring (emerald edge glow)
 * - Ink Dark tokens
 * - startIcon: LucideIcon rendered inside the input (left)
 * - endAdornment: text/node rendered inside the input (right, e.g. "€", "%")
 * - aria-invalid support
 */
import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BrandInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helpText?: string;
  /** Lucide icon displayed at the start of the input */
  startIcon?: LucideIcon;
  /** Text or node displayed at the end of the input (e.g. "€", "%") */
  endAdornment?: React.ReactNode;
}

const BrandInput = React.forwardRef<HTMLInputElement, BrandInputProps>(
  (
    {
      className,
      label,
      error,
      helpText,
      id,
      type = 'text',
      startIcon: StartIcon,
      endAdornment,
      ...props
    },
    ref,
  ) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;
    const errorId = error ? `${inputId}-error` : undefined;
    const helpId = helpText && !error ? `${inputId}-help` : undefined;

    const hasStart = !!StartIcon;
    const hasEnd = !!endAdornment;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-medium uppercase tracking-wide text-[var(--text-2)]"
          >
            {label}
          </label>
        )}

        <div className="relative">
          {/* Start icon */}
          {StartIcon && (
            <span
              className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[var(--text-3)]"
              aria-hidden="true"
            >
              <StartIcon className="h-4 w-4" strokeWidth={1.5} />
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            type={type}
            {...(error ? { 'aria-invalid': 'true' as const } : {})}
            aria-describedby={
              [errorId, helpId].filter(Boolean).join(' ') || undefined
            }
            className={cn(
              // Base
              'flex w-full rounded-[var(--r2)] py-3 text-sm',
              'bg-[var(--surface-1)] text-[var(--text-1)]',
              'border transition-all duration-[var(--duration-normal)]',
              'placeholder:text-[var(--text-3)]',
              // Horizontal padding (adjusted for icons/adornments)
              hasStart ? 'pl-10' : 'px-4',
              hasEnd ? 'pr-10' : hasStart ? 'pr-4' : '',
              // Focus: Race Light
              'focus-visible:outline-none',
              'focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-void)]',
              // Disabled
              'disabled:cursor-not-allowed disabled:opacity-50',
              // Border state
              error
                ? 'border-[var(--brand-danger)] focus-visible:ring-[var(--brand-danger)]'
                : 'border-[var(--border-1)] hover:border-[var(--border-2)]',
              className,
            )}
            {...props}
          />

          {/* End adornment */}
          {endAdornment && (
            <span
              className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-xs font-medium text-[var(--text-3)]"
              aria-hidden="true"
            >
              {endAdornment}
            </span>
          )}
        </div>

        {error && (
          <p
            id={errorId}
            role="alert"
            className="text-xs text-[var(--brand-danger)]"
          >
            {error}
          </p>
        )}

        {helpText && !error && (
          <p id={helpId} className="text-xs text-[var(--text-3)]">
            {helpText}
          </p>
        )}
      </div>
    );
  },
);
BrandInput.displayName = 'BrandInput';

export { BrandInput };
