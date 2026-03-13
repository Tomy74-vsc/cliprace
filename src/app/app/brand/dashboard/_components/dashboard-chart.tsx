'use client';

import type { BrandDashboardStats } from '../_types';
import { Panel, EmptyState } from '@/components/brand-ui';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

interface DashboardChartProps {
  data: BrandDashboardStats['viewsOverTime'];
}

const periods = [
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
] as const;

function PeriodSelector() {
  return (
    <div
      className="inline-flex rounded-[var(--r2)] border border-[var(--border-1)] p-0.5"
      role="tablist"
      aria-label="Analytics period"
    >
      {periods.map((p) => (
        <button
          // Static for now: 30d selected
          key={p.key}
          type="button"
          role="tab"
          aria-selected={p.key === '30d'}
          className={
            p.key === '30d'
              ? 'rounded-[8px] px-3 py-1 text-xs font-medium bg-[var(--surface-2)] text-[var(--text-1)]'
              : 'rounded-[8px] px-3 py-1 text-xs font-medium text-[var(--text-3)] hover:text-[var(--text-2)]'
          }
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

export function DashboardChart({ data }: DashboardChartProps) {
  const hasData = data.some((d) => d.views > 0 || d.submissions > 0);

  return (
    <Panel
      title="Views over 30 days"
      action={<PeriodSelector />}
      className="h-full"
    >
      {!hasData ? (
        <div className="h-[220px] flex items-center justify-center">
          <EmptyState
            title="No data yet"
            description="Your chart will populate as campaigns start receiving views."
          />
        </div>
      ) : (
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid
                stroke="rgba(148,163,184,0.2)"
                strokeDasharray="4 4"
                vertical={false}
              />
              <XAxis
                dataKey="date"
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
                dataKey="submissions"
                stroke="rgba(148,163,184,0.9)"
                strokeWidth={1.5}
                dot={false}
                name="Submissions"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}

