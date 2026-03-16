'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import type { ContestDetail, ContestMetrics, LeaderboardEntry, SubmissionItem } from '../_types';
import { TabOverview } from './tabs/tab-overview';
import { TabUgc } from './tabs/tab-ugc';
import { TabLeaderboard } from './tabs/tab-leaderboard';
import { TabAnalytics } from './tabs/tab-analytics';
import { TabSettings } from './tabs/tab-settings';

type ContestTab = 'overview' | 'ugc' | 'leaderboard' | 'analytics' | 'settings';

interface ContestTabsProps {
  contestId: string;
  activeTab: ContestTab;
  contest: ContestDetail;
  metrics: ContestMetrics | null;
  submissions: { submissions: SubmissionItem[]; total: number } | null;
  leaderboard: LeaderboardEntry[] | null;
  submissionsPagination: { page: number; pageSize: number };
}

export function ContestTabs({
  contestId,
  activeTab,
  contest,
  metrics,
  submissions,
  leaderboard,
  submissionsPagination,
}: ContestTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'overview') {
      params.delete('tab');
    } else {
      params.set('tab', value);
    }
    // Reset pagination when switching tabs
    params.delete('page');
    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ''}`);
  };

  return (
    <Tabs
      value={activeTab}
      onValueChange={handleTabChange}
      className="space-y-4"
    >
      <TabsList
        className="inline-flex h-9 items-center justify-start gap-1 rounded-[var(--r2)] bg-[var(--surface-2)]/60 px-1 py-1"
        data-testid="contest-tabs"
      >
        <TabsTrigger
          value="overview"
          className="px-3 py-1.5 text-xs font-medium data-[state=active]:bg-[var(--surface-1)] data-[state=active]:text-[var(--text-1)] data-[state=active]:shadow-[0_1px_0_rgba(16,185,129,0.25)] data-[state=active]:border-b-2 data-[state=active]:border-b-[var(--accent)] text-[var(--text-2)]"
        >
          Overview
        </TabsTrigger>
        <TabsTrigger
          value="ugc"
          className="px-3 py-1.5 text-xs font-medium data-[state=active]:bg-[var(--surface-1)] data-[state=active]:text-[var(--text-1)] data-[state=active]:shadow-[0_1px_0_rgba(16,185,129,0.25)] data-[state=active]:border-b-2 data-[state=active]:border-b-[var(--accent)] text-[var(--text-2)]"
        >
          UGC
        </TabsTrigger>
        <TabsTrigger
          value="leaderboard"
          className="px-3 py-1.5 text-xs font-medium data-[state=active]:bg-[var(--surface-1)] data-[state=active]:text-[var(--text-1)] data-[state=active]:shadow-[0_1px_0_rgba(16,185,129,0.25)] data-[state=active]:border-b-2 data-[state=active]:border-b-[var(--accent)] text-[var(--text-2)]"
        >
          Leaderboard
        </TabsTrigger>
        <TabsTrigger
          value="analytics"
          className="px-3 py-1.5 text-xs font-medium data-[state=active]:bg-[var(--surface-1)] data-[state=active]:text-[var(--text-1)] data-[state=active]:shadow-[0_1px_0_rgba(16,185,129,0.25)] data-[state=active]:border-b-2 data-[state=active]:border-b-[var(--accent)] text-[var(--text-2)]"
        >
          Analytics
        </TabsTrigger>
        <TabsTrigger
          value="settings"
          className="px-3 py-1.5 text-xs font-medium data-[state=active]:bg-[var(--surface-1)] data-[state=active]:text-[var(--text-1)] data-[state=active]:shadow-[0_1px_0_rgba(16,185,129,0.25)] data-[state=active]:border-b-2 data-[state=active]:border-b-[var(--accent)] text-[var(--text-2)]"
        >
          Settings
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="mt-4">
        {metrics && (
          <TabOverview contest={contest} metrics={metrics} />
        )}
      </TabsContent>

      <TabsContent value="ugc" className="mt-4">
        {submissions && (
          <TabUgc
            contest={contest}
            submissions={submissions.submissions}
            total={submissions.total}
            page={submissionsPagination.page}
            pageSize={submissionsPagination.pageSize}
            status={(searchParams.get('status') as 'all' | 'pending' | 'approved' | 'rejected') || 'all'}
          />
        )}
      </TabsContent>

      <TabsContent value="leaderboard" className="mt-4">
        {leaderboard && (
          <TabLeaderboard contest={contest} leaderboard={leaderboard} />
        )}
      </TabsContent>

      <TabsContent value="analytics" className="mt-4">
        <TabAnalytics metrics={metrics} />
      </TabsContent>

      <TabsContent value="settings" className="mt-4">
        <TabSettings contest={contest} />
      </TabsContent>
    </Tabs>
  );
}

