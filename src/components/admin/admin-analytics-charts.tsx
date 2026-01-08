'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatDate } from '@/lib/formatters';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

/**
 * Graphique d'évolution temporelle (vues, engagement, revenus)
 */
export function AdminTimeSeriesChart({
  data,
  title = 'Évolution',
  height = 300,
}: {
  data: Array<{ date: string; views?: number; engagement?: number; revenue_cents?: number; users?: number }>;
  title?: string;
  height?: number;
}) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[300px] items-center justify-center text-muted-foreground">Aucune donnée</div>
        </CardContent>
      </Card>
    );
  }

  const hasRevenue = data.some((d) => d.revenue_cents !== undefined);
  const hasUsers = data.some((d) => d.users !== undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorEngagement" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => formatDate(value)}
              className="text-xs"
              tick={{ fill: 'currentColor' }}
            />
            <YAxis className="text-xs" tick={{ fill: 'currentColor' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '0.5rem',
              }}
              formatter={(value: number, name: string) => {
                if (name === 'revenue_cents') return formatCurrency(value, 'EUR');
                return value.toLocaleString();
              }}
              labelFormatter={(label) => formatDate(label)}
            />
            <Legend />
            {data[0]?.views !== undefined && (
              <Area
                type="monotone"
                dataKey="views"
                stroke="#3b82f6"
                fillOpacity={1}
                fill="url(#colorViews)"
                name="Vues"
              />
            )}
            {data[0]?.engagement !== undefined && (
              <Area
                type="monotone"
                dataKey="engagement"
                stroke="#10b981"
                fillOpacity={1}
                fill="url(#colorEngagement)"
                name="Engagement"
              />
            )}
            {hasRevenue && (
              <Area
                type="monotone"
                dataKey="revenue_cents"
                stroke="#f59e0b"
                fillOpacity={1}
                fill="url(#colorRevenue)"
                name="Revenus"
              />
            )}
            {hasUsers && (
              <Area
                type="monotone"
                dataKey="users"
                stroke="#8b5cf6"
                fillOpacity={1}
                fill="url(#colorUsers)"
                name="Utilisateurs"
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

/**
 * Graphique en barres pour comparaisons
 */
export function AdminBarChart({
  data,
  title,
  xKey = 'name',
  yKey = 'value',
  height = 300,
}: {
  data: Array<Record<string, string | number>>;
  title: string;
  xKey?: string;
  yKey?: string;
  height?: number;
}) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[300px] items-center justify-center text-muted-foreground">Aucune donnée</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey={xKey} className="text-xs" tick={{ fill: 'currentColor' }} />
            <YAxis className="text-xs" tick={{ fill: 'currentColor' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '0.5rem',
              }}
            />
            <Bar dataKey={yKey} fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

/**
 * Graphique en camembert pour répartitions
 */
export function AdminPieChart({
  data,
  title,
  nameKey = 'name',
  valueKey = 'value',
  height = 300,
}: {
  data: Array<Record<string, string | number>>;
  title: string;
  nameKey?: string;
  valueKey?: string;
  height?: number;
}) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[300px] items-center justify-center text-muted-foreground">Aucune donnée</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey={valueKey}
              nameKey={nameKey}
            >
              {data.map((_entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '0.5rem',
              }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

/**
 * Graphique de funnel (conversion)
 */
export function AdminFunnelChart({
  data,
  title = 'Funnel de conversion',
  height = 400,
}: {
  data: Array<{ stage: string; value: number; percentage?: number }>;
  title?: string;
  height?: number;
}) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[400px] items-center justify-center text-muted-foreground">Aucune donnée</div>
        </CardContent>
      </Card>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.value));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4" style={{ minHeight: height }}>
          {data.map((item, index) => {
            const width = (item.value / maxValue) * 100;
            const conversion = index > 0 ? ((item.value / data[index - 1].value) * 100).toFixed(1) : '100.0';
            return (
              <div key={item.stage} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{item.stage}</span>
                  <span className="text-muted-foreground">
                    {item.value.toLocaleString()} ({conversion}%)
                  </span>
                </div>
                <div className="h-8 w-full rounded-lg bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-500 flex items-center justify-end pr-2"
                    style={{ width: `${width}%` }}
                  >
                    {width > 10 && (
                      <span className="text-xs text-primary-foreground font-medium">
                        {item.percentage ? `${item.percentage.toFixed(1)}%` : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Graphique de cohortes (rétention)
 */
export function AdminCohortChart({
  data,
  title = 'Rétention par cohorte',
  height = 400,
}: {
  data: Array<{ cohort: string; week0: number; week1: number; week2: number; week3: number; week4: number }>;
  title?: string;
  height?: number;
}) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[400px] items-center justify-center text-muted-foreground">Aucune donnée</div>
        </CardContent>
      </Card>
    );
  }

  const weeks = ['week0', 'week1', 'week2', 'week3', 'week4'];
  const maxValue = Math.max(...data.flatMap((d) => weeks.map((w) => d[w as keyof typeof d] as number)));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto" style={{ minHeight: height }}>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left p-2 border-b">Cohorte</th>
                {weeks.map((w, i) => (
                  <th key={w} className="text-center p-2 border-b">
                    Semaine {i}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.cohort}>
                  <td className="p-2 border-b font-medium">{row.cohort}</td>
                  {weeks.map((w) => {
                    const value = row[w as keyof typeof row] as number;
                    const percentage = ((value / (row.week0 as number)) * 100).toFixed(1);
                    const intensity = (value / maxValue) * 100;
                    return (
                      <td key={w} className="p-2 border-b text-center">
                        <div
                          className="inline-block px-2 py-1 rounded text-xs font-medium"
                          style={{
                            backgroundColor: `hsl(var(--primary) / ${intensity / 100})`,
                            color: intensity > 50 ? 'hsl(var(--primary-foreground))' : 'currentColor',
                          }}
                        >
                          {value.toLocaleString()} ({percentage}%)
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

