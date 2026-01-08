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
        'group relative overflow-hidden',
        'rounded-3xl border border-border/50',
        'bg-gradient-to-br from-card/90 via-card/80 to-card/70',
        'backdrop-blur-xl',
        'shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)]',
        'dark:shadow-[0_4px_6px_-1px_rgba(0,0,0,0.3),0_2px_4px_-1px_rgba(0,0,0,0.2)]',
        'transition-all duration-300',
        'hover:shadow-xl hover:border-border',
        'px-5 py-4 md:px-6 md:py-5',
        'animate-fadeInUp',
        className
      )}
    >
      {/* Gradient accent subtle */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3 md:gap-4">
          {icon ? (
            <div className="mt-0.5 flex h-11 w-11 md:h-12 md:w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-muted/80 to-muted/60 border border-border/50 shadow-sm transition-all duration-300 group-hover:scale-105 group-hover:shadow-md">
              {icon}
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <h1 
              className="text-2xl md:text-3xl lg:text-4xl font-extrabold tracking-tight truncate bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text" 
              id="admin-page-title"
            >
              {title}
            </h1>
            {description ? (
              <p className="mt-1.5 md:mt-2 text-sm md:text-base text-muted-foreground leading-relaxed" id="admin-page-description">
                {description}
              </p>
            ) : null}
            {badges ? (
              <div className="mt-3 md:mt-4 flex flex-wrap gap-2" role="group" aria-label="Badges de statut">
                {badges}
              </div>
            ) : null}
          </div>
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}

