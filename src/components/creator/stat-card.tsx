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
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('transition-all hover:-translate-y-[2px] hover:shadow-card-hover', className)}>
      <CardHeader className="flex flex-row items-start justify-between">
        <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">{label}</CardTitle>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-2xl font-semibold">{value}</div>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
