'use client';

import * as React from 'react';
import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  checked?: boolean;
  indeterminate?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, indeterminate, onCheckedChange, ...props }, ref) => {
    const inputRef = React.useRef<HTMLInputElement | null>(null);

    React.useEffect(() => {
      if (!inputRef.current) return;
      inputRef.current.indeterminate = Boolean(indeterminate);
    }, [indeterminate]);

    const setRefs = (node: HTMLInputElement | null) => {
      inputRef.current = node;
      if (!ref) return;
      if (typeof ref === 'function') {
        ref(node);
        return;
      }
      (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (onCheckedChange) {
        onCheckedChange(e.target.checked);
      }
    };

    const isIndeterminate = Boolean(indeterminate && !checked);

    return (
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          ref={setRefs}
          checked={checked}
          onChange={handleChange}
          className="sr-only peer"
          aria-checked={isIndeterminate ? 'mixed' : checked}
          {...props}
        />
        <div
          className={cn(
            'h-4 w-4 shrink-0 rounded-sm border-2 transition-all flex items-center justify-center',
            'focus-within:outline-none focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            checked || indeterminate
              ? 'bg-primary border-primary text-primary-foreground'
              : 'bg-background border-input hover:border-primary/50',
            className
          )}
        >
          {isIndeterminate ? (
            <Minus className="h-3 w-3 text-primary-foreground stroke-[3]" />
          ) : checked ? (
            <Check className="h-3 w-3 text-primary-foreground stroke-[3]" />
          ) : null}
        </div>
      </label>
    );
  }
);
Checkbox.displayName = 'Checkbox';

export { Checkbox };

