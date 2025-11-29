import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

type EmptyStateAction =
  | {
      label: string;
      href: string;
      onClick?: never;
      variant?: 'primary' | 'secondary' | 'ghost';
    }
  | {
      label: string;
      href?: never;
      onClick: () => void;
      variant?: 'primary' | 'secondary' | 'ghost';
    };

export function EmptyState({
  title,
  description,
  action,
  secondaryAction,
  className,
  children,
}: {
  title: string;
  description?: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  className?: string;
  children?: ReactNode;
}) {
  const renderAction = (config?: EmptyStateAction) => {
    if (!config) return null;
    if (config.href) {
      return (
        <Button asChild variant={config.variant ?? 'primary'}>
          <a href={config.href}>{config.label}</a>
        </Button>
      );
    }
    return (
      <Button onClick={config.onClick} variant={config.variant ?? 'primary'}>
        {config.label}
      </Button>
    );
  };

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-10 text-center shadow-card',
        className,
      )}
    >
      <div className="text-lg font-semibold">{title}</div>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      {children}
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        {renderAction(action)}
        {renderAction(secondaryAction)}
      </div>
    </div>
  );
}
