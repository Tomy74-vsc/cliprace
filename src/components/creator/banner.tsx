import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Info, AlertTriangle, XCircle } from 'lucide-react';

type BannerVariant = 'info' | 'warning' | 'error';

const iconByVariant: Record<BannerVariant, JSX.Element> = {
  info: <Info className="h-4 w-4" />,
  warning: <AlertTriangle className="h-4 w-4" />,
  error: <XCircle className="h-4 w-4" />,
};

export function Banner({
  title,
  description,
  variant = 'info',
  action,
  className,
}: {
  title: string;
  description?: string;
  variant?: BannerVariant;
  action?: ReactNode;
  className?: string;
}) {
  const base = {
    info: 'bg-info/10 border-info/30 text-foreground',
    warning: 'bg-warning/15 border-warning/30 text-foreground',
    error: 'bg-danger/10 border-danger/40 text-foreground',
  }[variant];

  return (
    <div
      className={cn(
        'w-full rounded-xl border px-4 py-3 flex items-start gap-3',
        'shadow-card',
        base,
        className
      )}
      role="status"
    >
      <div className="mt-0.5 text-muted-foreground">{iconByVariant[variant]}</div>
      <div className="flex-1 space-y-1">
        <p className="text-sm font-semibold">{title}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
