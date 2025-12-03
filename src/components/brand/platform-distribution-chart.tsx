'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface PlatformDistributionChartProps {
  data: Record<string, number>;
}

const PLATFORM_COLORS: Record<string, string> = {
  tiktok: '#000000',
  instagram: '#E4405F',
  youtube: '#FF0000',
};

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  youtube: 'YouTube',
};

export function PlatformDistributionChart({ data }: PlatformDistributionChartProps) {
  if (!data || Object.keys(data).length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
        Aucune donnée disponible pour le moment
      </div>
    );
  }

  const chartData = Object.entries(data)
    .map(([platform, count]) => ({
      name: PLATFORM_LABELS[platform.toLowerCase()] || platform,
      value: count,
      platform: platform.toLowerCase(),
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);

  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          outerRadius={75}
          innerRadius={35}
          fill="#8884d8"
          dataKey="value"
          stroke="hsl(var(--card))"
          strokeWidth={2}
        >
          {chartData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={PLATFORM_COLORS[entry.platform] || `hsl(var(--primary))`}
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
          }}
          formatter={(value: number) => [
            `${value} soumission${value > 1 ? 's' : ''} (${((value / total) * 100).toFixed(1)}%)`,
            'Soumissions',
          ]}
        />
        <Legend
          verticalAlign="bottom"
          height={36}
          iconType="circle"
          wrapperStyle={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))' }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

