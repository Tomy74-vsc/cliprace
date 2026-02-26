'use client';

import { Area, ComposedChart, Line, ResponsiveContainer, Tooltip } from 'recharts';

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
  height?: number | string;
  variant?: 'default' | 'lens';
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
  height = 320,
  variant = 'default',
  className,
}: RoiPerformanceChartProps) {
  if (!data || data.length === 0) {
    return (
      <div
        className={cn(
          'flex h-[320px] items-center justify-center rounded-[2rem] border border-black/5 bg-white/30 text-sm text-muted-foreground backdrop-blur-3xl ring-1 ring-inset ring-black/5 dark:border-white/10 dark:bg-zinc-900/40 dark:ring-white/5',
          className
        )}
      >
        Aucune donnée sur la période
      </div>
    );
  }

  return (
    <div className={cn('w-full', className)}>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart
          data={data}
          margin={
            variant === 'lens'
              ? { top: 4, right: 10, left: 10, bottom: 0 }
              : { top: 12, right: 12, left: 12, bottom: 8 }
          }
        >
          <defs>
            <filter id="roi-neon-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <linearGradient id="roi-underfill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
              <stop offset="70%" stopColor="#10b981" stopOpacity="0.06" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
            </linearGradient>
          </defs>

          {variant !== 'lens' ? (
            <Tooltip
              cursor={false}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;

                const viewsValue =
                  (payload.find((item) => item.dataKey === 'views')?.value as number) ?? 0;
                const budgetValue =
                  (payload.find((item) => item.dataKey === 'budget_cents')?.value as number) ?? 0;

                return (
                  <div className="rounded-xl bg-zinc-950/80 backdrop-blur-xl border border-white/10 p-3 shadow-2xl">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
                      {label}
                    </p>
                    <p className="text-sm text-zinc-300">
                      Vues:{' '}
                      <span className="font-semibold tabular-nums text-zinc-100">
                        {viewsValue.toLocaleString()}
                      </span>
                    </p>
                    <p className="text-sm text-zinc-300">
                      Budget:{' '}
                      <span className="font-semibold tabular-nums text-zinc-100">
                        {formatCents(budgetValue, currency)}
                      </span>
                    </p>
                  </div>
                );
              }}
            />
          ) : null}

          {variant === 'lens' ? (
            <Area
              type="monotone"
              dataKey="views"
              stroke="#10b981"
              strokeWidth={2.8}
              fill="url(#roi-underfill)"
              fillOpacity={1}
              dot={false}
              activeDot={false}
              isAnimationActive={false}
              filter="url(#roi-neon-glow)"
            />
          ) : (
            <>
              <Line
                type="monotone"
                dataKey="views"
                stroke="#10b981"
                strokeWidth={2.8}
                dot={false}
                filter="url(#roi-neon-glow)"
                activeDot={{
                  r: 4,
                  fill: '#10b981',
                  stroke: '#10b981',
                  strokeWidth: 1,
                }}
              />
              <Line
                type="monotone"
                dataKey="budget_cents"
                stroke="#10b981"
                strokeOpacity={0.35}
                strokeWidth={1.4}
                dot={false}
                filter="url(#roi-neon-glow)"
              />
            </>
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

