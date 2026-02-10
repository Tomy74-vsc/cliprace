'use client';

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { cn } from '@/lib/utils';

export interface RoiPerformanceChartDataPoint {
  date: string;
  label: string;
  views: number;
  budget_cents: number;
}

export interface RoiPerformanceChartProps {
  data: RoiPerformanceChartDataPoint[];
  currency?: string;
  className?: string;
}

function formatCents(cents: number, currency = 'EUR') {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function RoiPerformanceChart({
  data,
  currency = 'EUR',
  className,
}: RoiPerformanceChartProps) {
  if (!data || data.length === 0) {
    return (
      <div
        className={cn(
          'flex h-[280px] items-center justify-center rounded-lg bg-muted/30 text-sm text-muted-foreground',
          className
        )}
      >
        Aucune donnée sur la période
      </div>
    );
  }

  return (
    <div className={cn('w-full', className)}>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
          <XAxis
            dataKey="label"
            stroke="hsl(var(--muted-foreground))"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={{ stroke: 'hsl(var(--border))' }}
          />
          <YAxis
            yAxisId="views"
            stroke="hsl(var(--muted-foreground))"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            width={50}
            tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
          />
          <YAxis
            yAxisId="budget"
            orientation="right"
            stroke="hsl(var(--muted-foreground))"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            width={56}
            tickFormatter={(v) => formatCents(v, currency)}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div
                  className={cn(
                    'rounded-xl border border-border/80 bg-background/95 px-4 py-3 shadow-lg',
                    'backdrop-blur-md'
                  )}
                >
                  <p className="text-sm font-semibold text-foreground mb-2">{label}</p>
                  <div className="space-y-1 text-sm">
                    <p className="text-muted-foreground">
                      Vues :{' '}
                      <span className="font-medium text-foreground">
                        {(payload[0]?.value as number)?.toLocaleString() ?? 0}
                      </span>
                    </p>
                    <p className="text-muted-foreground">
                      Budget :{' '}
                      <span className="font-medium text-foreground">
                        {formatCents((payload[1]?.value as number) ?? 0, currency)}
                      </span>
                    </p>
                  </div>
                </div>
              );
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            formatter={(value) => (value === 'views' ? 'Vues' : 'Budget dépensé')}
          />
          <Bar
            yAxisId="budget"
            dataKey="budget_cents"
            name="budget"
            fill="hsl(var(--primary) / 0.2)"
            stroke="hsl(var(--primary))"
            radius={[4, 4, 0, 0]}
            maxBarSize={40}
          />
          <Line
            yAxisId="views"
            type="monotone"
            dataKey="views"
            name="views"
            stroke="hsl(var(--accent))"
            strokeWidth={2}
            dot={{ fill: 'hsl(var(--accent))', r: 3 }}
            activeDot={{ r: 5, fill: 'hsl(var(--accent))' }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
