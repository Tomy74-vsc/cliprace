'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface AdminMetricsChartProps {
  data: Array<{ date: string; views: number; engagement: number }>;
}

export function AdminMetricsChart({ data }: AdminMetricsChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
        Aucune donnée pour le moment
      </div>
    );
  }

  const formatted = data.map((d) => ({
    date: new Date(d.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
    views: d.views,
    engagement: d.engagement,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={formatted} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
        <XAxis
          dataKey="date"
          stroke="hsl(var(--muted-foreground))"
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={{ stroke: 'hsl(var(--border))' }}
        />
        <YAxis
          stroke="hsl(var(--muted-foreground))"
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={{ stroke: 'hsl(var(--border))' }}
          width={60}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
          }}
          labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
          itemStyle={{ color: 'hsl(var(--muted-foreground))' }}
          formatter={(value: number, name: string) => {
            const label = name === 'views' ? 'Views' : 'Engagement';
            return [value.toLocaleString(), label];
          }}
        />
        <Line
          type="monotone"
          dataKey="views"
          stroke="hsl(var(--primary))"
          strokeWidth={2.5}
          dot={{ fill: 'hsl(var(--primary))', r: 4, strokeWidth: 2, stroke: 'hsl(var(--card))' }}
          activeDot={{ r: 6, stroke: 'hsl(var(--primary))', strokeWidth: 2 }}
        />
        <Line
          type="monotone"
          dataKey="engagement"
          stroke="hsl(var(--accent))"
          strokeWidth={2.5}
          dot={{ fill: 'hsl(var(--accent))', r: 4, strokeWidth: 2, stroke: 'hsl(var(--card))' }}
          activeDot={{ r: 6, stroke: 'hsl(var(--accent))', strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
