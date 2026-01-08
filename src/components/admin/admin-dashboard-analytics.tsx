'use client';

import { useState, useEffect } from 'react';
import { AdminTimeSeriesChart, AdminFunnelChart, AdminCohortChart, AdminPieChart } from './admin-analytics-charts';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type AnalyticsData = {
  timeSeries?: Array<{ date: string; views: number; engagement: number; revenue_cents: number; users: number }>;
  funnel?: Array<{ stage: string; value: number; percentage: number }>;
  cohorts?: Array<{ cohort: string; week0: number; week1: number; week2: number; week3: number; week4: number }>;
  distribution?: Array<{ name: string; value: number }>;
};

export function AdminDashboardAnalytics() {
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsData>({});

  useEffect(() => {
    const loadAnalytics = async () => {
      setLoading(true);
      try {
        const [timeSeriesRes, funnelRes, cohortsRes, distributionRes] = await Promise.all([
          fetch(`/api/admin/analytics?type=timeSeries&range=${range}`),
          fetch(`/api/admin/analytics?type=funnel&range=${range}`),
          fetch(`/api/admin/analytics?type=cohorts&range=${range}`),
          fetch(`/api/admin/analytics?type=distribution&range=${range}`),
        ]);

        const timeSeries = timeSeriesRes.ok ? await timeSeriesRes.json() : null;
        const funnel = funnelRes.ok ? await funnelRes.json() : null;
        const cohorts = cohortsRes.ok ? await cohortsRes.json() : null;
        const distribution = distributionRes.ok ? await distributionRes.json() : null;

        setData({
          timeSeries: timeSeries?.data || [],
          funnel: funnel?.data || [],
          cohorts: cohorts?.data || [],
          distribution: distribution?.data || [],
        });
      } catch (error) {
        console.error('Failed to load analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    void loadAnalytics();
  }, [range]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-64 animate-pulse rounded-2xl bg-muted" />
        <div className="h-64 animate-pulse rounded-2xl bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Analytics avancés</h2>
        <div className="flex gap-2">
          <Button
            variant={range === '7d' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setRange('7d')}
          >
            7 jours
          </Button>
          <Button
            variant={range === '30d' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setRange('30d')}
          >
            30 jours
          </Button>
          <Button
            variant={range === '90d' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setRange('90d')}
          >
            90 jours
          </Button>
        </div>
      </div>

      <Tabs defaultValue="evolution" className="space-y-4">
        <TabsList>
          <TabsTrigger value="evolution">Évolution</TabsTrigger>
          <TabsTrigger value="funnel">Funnel</TabsTrigger>
          <TabsTrigger value="cohorts">Cohortes</TabsTrigger>
          <TabsTrigger value="distribution">Répartition</TabsTrigger>
        </TabsList>

        <TabsContent value="evolution">
          <AdminTimeSeriesChart
            data={data.timeSeries || []}
            title={`Évolution sur ${range === '7d' ? '7 jours' : range === '30d' ? '30 jours' : '90 jours'}`}
            height={400}
          />
        </TabsContent>

        <TabsContent value="funnel">
          <AdminFunnelChart data={data.funnel || []} title="Funnel de conversion" height={400} />
        </TabsContent>

        <TabsContent value="cohorts">
          <AdminCohortChart data={data.cohorts || []} title="Rétention par cohorte" height={400} />
        </TabsContent>

        <TabsContent value="distribution">
          <AdminPieChart
            data={data.distribution || []}
            title="Répartition par plateforme"
            nameKey="name"
            valueKey="value"
            height={400}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

