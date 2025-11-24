import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: { label: string; href?: string; onClick?: () => void; variant?: 'primary' | 'secondary' };
  className?: string;
}) {
  const button =
    action &&
    (action.href ? (
      <Button asChild variant={action.variant ?? 'primary'}>
        <a href={action.href}>{action.label}</a>
      </Button>
    ) : (
      <Button onClick={action.onClick} variant={action.variant ?? 'primary'}>
        {action.label}
      </Button>
    ));

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-10 text-center shadow-card',
        className
      )}
    >
      <div className="text-lg font-semibold">{title}</div>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      {button}
    </div>
  );
}
