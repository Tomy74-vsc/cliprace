'use client';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { Panel, EmptyState } from '@/components/brand-ui';
import type { ContestMetrics } from '../../_types';

interface TabAnalyticsProps {
  metrics: ContestMetrics | null;
}

export function TabAnalytics({ metrics }: TabAnalyticsProps) {
  // For now, approximate a simple time series using cumulative views if present later.
  const hasAny =
    metrics &&
    (metrics.totalViews > 0 ||
      metrics.totalLikes > 0 ||
      metrics.totalComments > 0 ||
      metrics.totalShares > 0);

  const summaryData = [
    { key: 'Views', value: metrics?.totalViews ?? 0 },
    { key: 'Likes', value: metrics?.totalLikes ?? 0 },
    { key: 'Comments', value: metrics?.totalComments ?? 0 },
    { key: 'Shares', value: metrics?.totalShares ?? 0 },
  ];

  return (
    <div className="space-y-4">
      <Panel
        title="Engagement breakdown"
        description="High-level engagement metrics for this campaign."
      >
        {!hasAny ? (
          <EmptyState
            title="No engagement data yet"
            description="Analytics will populate once submissions start receiving views and interactions."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {summaryData.map((item) => (
              <div
                key={item.key}
                className="rounded-[var(--r3)] border border-[var(--border-1)] bg-[var(--surface-1)]/80 p-4"
              >
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]">
                  {item.key}
                </p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--text-1)]">
                  {item.value.toLocaleString('en-US')}
                </p>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title="Views vs interactions"
        description="Compare views with likes over time."
        className="h-full"
      >
        {!hasAny ? (
          <div className="flex h-[220px] items-center justify-center">
            <EmptyState
              title="No time-series data yet"
              description="This chart will activate as soon as metrics are available."
            />
          </div>
        ) : (
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={[
                  {
                    label: 'Campaign',
                    views: metrics?.totalViews ?? 0,
                    likes: metrics?.totalLikes ?? 0,
                  },
                ]}
              >
                <CartesianGrid
                  stroke="rgba(148,163,184,0.2)"
                  strokeDasharray="4 4"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: 'rgba(148,163,184,0.8)' }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: 'rgba(148,163,184,0.8)' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15,23,42,0.95)',
                    borderRadius: 12,
                    border: '1px solid rgba(148,163,184,0.4)',
                    color: '#e5e7eb',
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="views"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={false}
                  name="Views"
                />
                <Line
                  type="monotone"
                  dataKey="likes"
                  stroke="rgba(148,163,184,0.9)"
                  strokeWidth={1.5}
                  dot={false}
                  name="Likes"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>
    </div>
  );
}

