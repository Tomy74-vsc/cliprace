import * as React from 'react';
import { cn } from '@/lib/utils';

export interface AccordionProps extends React.HTMLAttributes<HTMLDivElement> {
  type?: 'single' | 'multiple';
  collapsible?: boolean;
}

export function Accordion({ className, children }: AccordionProps) {
  return <div className={cn('space-y-2', className)}>{children}</div>;
}

export function AccordionItem({
  value: _value,
  className,
  children,
}: React.HTMLAttributes<HTMLDivElement> & { value: string }) {
  return <div className={cn('border-b border-border last:border-b-0', className)}>{children}</div>;
}

export function AccordionTrigger({
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center justify-between py-3 text-sm font-medium transition-all hover:text-primary',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function AccordionContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('pb-3 pt-0.5 text-sm', className)} {...props}>
      {children}
    </div>
  );
}

