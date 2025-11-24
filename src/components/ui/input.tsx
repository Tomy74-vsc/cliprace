// Source: Design System — Inputs
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helpText?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helpText, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium mb-1.5">
            {label}
          </label>
        )}
        <input
          id={inputId}
          className={cn(
            'flex w-full rounded-xl border bg-background px-4 py-3 text-sm',
            'ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium',
            'placeholder:text-muted-foreground/80',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error ? 'border-destructive focus-visible:ring-destructive' : 'border-input',
            className
          )}
          ref={ref}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        {helpText && !error && (
          <p className="mt-1.5 text-sm text-muted-foreground">
            {helpText}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

export { Input };
