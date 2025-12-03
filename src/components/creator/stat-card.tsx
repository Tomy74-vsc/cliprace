import { type ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function StatCard({
  label,
  value,
  hint,
  className,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('group transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover border-border/60 hover:border-primary/20', className)}>
      <CardHeader className="flex flex-row items-start justify-between">
        <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground transition-colors duration-200 group-hover:text-foreground/80">{label}</CardTitle>
        {icon && <div className="text-muted-foreground transition-transform duration-200 group-hover:scale-110 group-hover:text-primary">{icon}</div>}
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-2xl font-semibold transition-colors duration-200 group-hover:text-primary">{value}</div>
        {hint && <p className="text-xs text-muted-foreground transition-colors duration-200 group-hover:text-muted-foreground/80">{hint}</p>}
      </CardContent>
    </Card>
  );
}
