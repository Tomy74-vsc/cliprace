'use client';

import {
  Bar,
  BarChart,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from 'recharts';
import { useEffect, useState } from 'react';

type DistributionMetrics = {
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
};

interface AnalyticsDistributionChartProps {
  metrics: DistributionMetrics;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const listener = (event: MediaQueryListEvent) => setReduced(event.matches);
    mq.addEventListener('change', listener);
    return () => mq.removeEventListener('change', listener);
  }, []);

  return reduced;
}

export function AnalyticsDistributionChart({
  metrics,
}: AnalyticsDistributionChartProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  const data = [
    { name: 'Views', value: metrics.totalViews },
    { name: 'Likes', value: metrics.totalLikes },
    { name: 'Comments', value: metrics.totalComments },
    { name: 'Shares', value: metrics.totalShares },
  ];

  const CustomTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: { value: number }[];
    label?: string;
  }) => {
    if (!active || !payload || !payload.length) return null;
    const value = payload[0]?.value ?? 0;
    return (
      <div className="rounded-[var(--r3)] border border-[var(--border-1)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--text-1)] shadow-[var(--shadow-1)]">
        <div className="font-medium">{label}</div>
        <div className="mt-0.5 text-[var(--text-2)]">
          {value.toLocaleString('en-US')} events
        </div>
      </div>
    );
  };

  return (
    <div className="h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis
            dataKey="name"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: 'rgba(148,163,184,0.8)' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey="value"
            fill="var(--accent)"
            opacity={0.8}
            isAnimationActive={!prefersReducedMotion}
            radius={[8, 8, 0, 0]}
          >
            <LabelList
              dataKey="value"
              position="top"
              formatter={(v: number) => v.toLocaleString('en-US')}
              style={{
                fontSize: 11,
                fill: 'rgba(226,232,240,0.9)',
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

