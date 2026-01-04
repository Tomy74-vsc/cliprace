import { cn } from '@/lib/utils';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function formatPrimitive(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '—';
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return `Liste (${value.length})`;
  if (isRecord(value)) return `Objet (${Object.keys(value).length})`;
  return formatPrimitive(value);
}

export function AdminObjectSummary({
  value,
  className,
  maxItems = 6,
}: {
  value: unknown;
  className?: string;
  maxItems?: number;
}) {
  if (!isRecord(value)) {
    const txt = formatValue(value);
    return <span className={cn('text-xs text-muted-foreground', className)}>{txt || '—'}</span>;
  }

  const entries = Object.entries(value)
    .filter(([_, v]) => v !== undefined)
    .slice(0, maxItems);

  if (entries.length === 0) {
    return <span className={cn('text-xs text-muted-foreground', className)}>—</span>;
  }

  return (
    <div className={cn('space-y-0.5 text-xs text-muted-foreground', className)}>
      {entries.map(([k, v]) => {
        const raw = formatValue(v);
        const shown = typeof v === 'string' && v.length > 64 ? `${v.slice(0, 64)}…` : raw;
        return (
          <div key={k} className="flex items-center justify-between gap-2">
            <span className="truncate">{k}</span>
            <span className="truncate max-w-[220px]">{shown}</span>
          </div>
        );
      })}
      {Object.keys(value).length > entries.length ? (
        <div className="text-[11px] text-muted-foreground/70">+{Object.keys(value).length - entries.length} champ(s)</div>
      ) : null}
    </div>
  );
}

