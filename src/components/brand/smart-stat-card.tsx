'use client';

import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

export interface SmartStatCardProps {
  title: string;
  value: string | number;
  /** e.g. "+15%" or "-8%" — optional */
  trend?: string;
  /** 'up' | 'down' | 'neutral' for badge color */
  trendDirection?: 'up' | 'down' | 'neutral';
  /** Sparkline data: array of { value: number } (or any with numeric value) */
  sparklineData?: Array<{ value: number; [k: string]: unknown }>;
  className?: string;
}

export function SmartStatCard({
  title,
  value,
  trend,
  trendDirection = 'neutral',
  sparklineData = [],
  className,
}: SmartStatCardProps) {
  const trendClass = {
    up: 'text-emerald-600 bg-emerald-500/10',
    down: 'text-red-600 bg-red-500/10',
    neutral: 'text-muted-foreground bg-muted/50',
  }[trendDirection];

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md',
        className
      )}
    >
      {/* Sparkline en arrière-plan */}
      {sparklineData.length > 1 && (
        <div className="absolute inset-0 flex items-end opacity-[0.08] pointer-events-none">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparklineData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="sparkline-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--primary))"
                fill="url(#sparkline-fill)"
                strokeWidth={1}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="relative">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <div className="mt-1 flex items-baseline gap-2 flex-wrap">
          <span className="text-2xl font-semibold tracking-tight text-foreground">
            {value}
          </span>
          {trend != null && (
            <span
              className={cn(
                'inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium',
                trendClass
              )}
            >
              {trend}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
