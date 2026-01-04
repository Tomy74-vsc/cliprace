import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type AdminPageHeaderProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  badges?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function AdminPageHeader({
  title,
  description,
  icon,
  badges,
  actions,
  className,
}: AdminPageHeaderProps) {
  return (
    <div
      className={cn(
        'rounded-3xl border border-border bg-card/70 backdrop-blur-xl shadow-soft px-5 py-4',
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          {icon ? (
            <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-muted/60 border border-border">
              {icon}
            </div>
          ) : null}
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight truncate">{title}</h1>
            {description ? (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            ) : null}
            {badges ? <div className="mt-3 flex flex-wrap gap-2">{badges}</div> : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

