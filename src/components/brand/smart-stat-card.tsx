'use client';

import type { ReactNode } from 'react';
import {
  Activity,
  Clock3,
  Eye,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import {
  Line,
  LineChart,
  ResponsiveContainer,
} from 'recharts';
import { cn } from '@/lib/utils';

export interface SmartStatCardProps {
  title: string;
  value: ReactNode;
  trend?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
  sparklineData?: Array<{ value: number; [k: string]: unknown }>;
  className?: string;
  valueClassName?: string;
}

type VisualConfig = {
  icon: LucideIcon;
  iconClassName: string;
};

function getVisualConfig(title: string): VisualConfig {
  const normalized = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (normalized.includes('budget') || normalized.includes('cout') || normalized.includes('cpv')) {
    return {
      icon: Wallet,
      iconClassName: 'bg-emerald-500/10 text-emerald-500 border border-current/10',
    };
  }

  if (normalized.includes('attente') || normalized.includes('video')) {
    return {
      icon: Clock3,
      iconClassName: 'bg-amber-500/10 text-amber-500 border border-current/10',
    };
  }

  if (normalized.includes('vue')) {
    return {
      icon: Eye,
      iconClassName: 'bg-blue-500/10 text-blue-500 border border-current/10',
    };
  }

  return {
    icon: Activity,
    iconClassName: 'bg-violet-500/10 text-violet-500 border border-current/10',
  };
}

export function SmartStatCard({
  title,
  value,
  trend,
  trendDirection = 'neutral',
  sparklineData = [],
  className,
  valueClassName,
}: SmartStatCardProps) {
  const visual = getVisualConfig(title);
  const Icon = visual.icon;

  const trendClass = {
    up: 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/20',
    down: 'bg-rose-500/15 text-rose-400 border border-rose-500/20',
    neutral: 'bg-zinc-500/15 text-zinc-300 border border-zinc-500/20',
  }[trendDirection];

  const sparklineColor = trendDirection === 'down' ? '#f43f5e' : '#10b981';

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[2rem] bg-white/5 backdrop-blur-3xl border border-white/10 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.3)] ring-1 ring-inset ring-white/5 p-6',
        className
      )}
    >
      <div className="relative z-10">
        <div className="flex items-center gap-3">
          <div className={cn('size-10 rounded-xl grid place-items-center', visual.iconClassName)}>
            <Icon className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-2">
          <span
            className={cn(
              'text-5xl font-bold tracking-[-0.05em] tabular-nums text-foreground',
              valueClassName
            )}
          >
            {value}
          </span>
          {trend ? (
            <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', trendClass)}>
              {trend}
            </span>
          ) : null}
        </div>
      </div>

      {sparklineData.length > 1 ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[30%]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparklineData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <Line
                type="monotone"
                dataKey="value"
                stroke={sparklineColor}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </div>
  );
}
