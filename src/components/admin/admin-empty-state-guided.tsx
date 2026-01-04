import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type AdminEmptyStateGuidedProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  className?: string;
};

export function AdminEmptyStateGuided({
  title,
  description,
  icon,
  primaryAction,
  secondaryAction,
  className,
}: AdminEmptyStateGuidedProps) {
  return (
    <div
      className={cn(
        'rounded-3xl border border-dashed border-border bg-card/50 backdrop-blur-xl shadow-soft px-6 py-8 text-center',
        className
      )}
    >
      {icon ? (
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/60 border border-border">
          {icon}
        </div>
      ) : null}
      <h3 className="text-base font-semibold">{title}</h3>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      {primaryAction || secondaryAction ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {primaryAction}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}

