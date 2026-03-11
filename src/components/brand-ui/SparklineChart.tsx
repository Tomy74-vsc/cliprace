'use client';

/**
 * SparklineChart — Tiny recharts line for KpiHero.
 * Lazy-loaded to avoid bloating SSR bundles.
 */
import { ResponsiveContainer, LineChart, Line } from 'recharts';

interface SparklineChartProps {
  data: number[];
}

export default function SparklineChart({ data }: SparklineChartProps) {
  const chartData = data.map((v, i) => ({ i, v }));

  return (
    <ResponsiveContainer width="100%" height={50}>
      <LineChart data={chartData}>
        <Line
          type="monotone"
          dataKey="v"
          stroke="var(--brand-accent, #10B981)"
          strokeWidth={1.5}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
