'use client';

import type { BrandDashboardStats } from '../_types';
import { KpiHero, Kpi } from '@/components/brand-ui';

interface DashboardKpisProps {
  stats: BrandDashboardStats;
}

export function DashboardKpis({ stats }: DashboardKpisProps) {
  const sparkline = stats.viewsOverTime.slice(-7).map((d) => d.views);

  return (
    <div className="space-y-4" data-testid="kpi-strip">
      <KpiHero
        label="Total views"
        value={stats.totalViews}
        unit="views"
        delta={stats.totalViewsDeltaPct ?? undefined}
        deltaLabel="vs last 30 days"
        format="number"
        sparkline={sparkline}
        beam
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi
          label="Active contests"
          value={stats.activeContests}
          unit=""
          delta={undefined}
          format="number"
        />
        <Kpi
          label="Total budget"
          value={Math.round(stats.totalBudgetCents / 100)}
          unit="€"
          format="currency"
        />
        <Kpi
          label="Pending submissions"
          value={stats.pendingSubmissions}
          unit=""
          delta={undefined}
          format="number"
        />
        <Kpi
          label="Total creators"
          value={stats.totalCreators}
          unit=""
          delta={undefined}
          format="number"
        />
      </div>
    </div>
  );
}

