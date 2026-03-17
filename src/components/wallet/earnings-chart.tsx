'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  type TooltipProps,
} from 'recharts';

export interface EarningsChartDataPoint {
  date: string;
  value: number;
  fullDate?: string;
}

export interface EarningsChartProps {
  data: EarningsChartDataPoint[];
  className?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length || !label) return null;
  const value = payload[0]?.value;
  if (value == null) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-white/10 bg-black/80 px-3 py-2 shadow-xl backdrop-blur-xl"
    >
      <p className="text-[11px] text-white/60">{label}</p>
      <p className="text-sm font-semibold text-emerald-400">
        {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(value)}
      </p>
    </motion.div>
  );
}

/** Build 30-day cumulative series from daily data (fill gaps with previous value). */
export function buildEarningsSeries(data: EarningsChartDataPoint[], days = 30): EarningsChartDataPoint[] {
  const result: EarningsChartDataPoint[] = [];
  const start = new Date();
  start.setDate(start.getDate() - days);
  const byDay = new Map<string, number>();
  data.forEach((d) => {
    const key = d.fullDate ?? d.date;
    byDay.set(key, (byDay.get(key) ?? 0) + d.value);
  });
  let cumulative = 0;
  for (let i = 0; i <= days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    cumulative += byDay.get(key) ?? 0;
    result.push({
      date: new Intl.DateTimeFormat('fr-FR', { month: 'short', day: 'numeric' }).format(d),
      fullDate: key,
      value: Math.round(cumulative * 100) / 100,
    });
  }
  return result;
}

export function EarningsChart({ data, className }: EarningsChartProps) {
  const series = useMemo(() => {
    if (data.length === 0) {
      const arr: EarningsChartDataPoint[] = [];
      for (let i = 30; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        arr.push({
          date: new Intl.DateTimeFormat('fr-FR', { month: 'short', day: 'numeric' }).format(d),
          fullDate: d.toISOString().slice(0, 10),
          value: 0,
        });
      }
      return arr;
    }
    return buildEarningsSeries(data);
  }, [data]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.1, duration: 0.3 }}
      className={className}
    >
      <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-4 backdrop-blur-sm">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-white/50">Gains sur 30 jours</p>
        <div className="h-[180px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
              <defs>
                <linearGradient id="earningsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(52, 211, 153)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="rgb(52, 211, 153)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" hide />
              <YAxis hide domain={['auto', 'auto']} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)' }} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="rgb(52, 211, 153)"
                strokeWidth={2}
                fill="url(#earningsGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </motion.div>
  );
}
