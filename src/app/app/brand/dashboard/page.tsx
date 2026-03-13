import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getSession } from '@/lib/auth';
import { getDashboardData } from './_data';
import { DashboardKpis } from './_components/dashboard-kpis';
import { DashboardChart } from './_components/dashboard-chart';
import { DashboardLiveRail } from './_components/dashboard-live-rail';
import { DashboardQuickActions } from './_components/dashboard-quick-actions';
import { RecentContestsTable } from './_components/recent-contests-table';
import { SkeletonKpiHero } from '@/components/brand-ui';

export const revalidate = 60;

export default async function BrandDashboardPage() {
  const { user } = await getSession();
  if (!user) {
    redirect('/auth/login');
  }

  const { stats, recentContests } = await getDashboardData(user.id);

  return (
    <div className="brand-scope max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-[var(--text-1)]">
            Dashboard
          </h1>
          <p className="text-[13px] text-[var(--text-3)] mt-0.5">
            Overview of your campaigns
          </p>
        </div>
        <Link href="/app/brand/contests/new">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-[var(--r2)] px-5 py-2.5 bg-[var(--cta-bg)] text-[var(--cta-fg)] text-sm font-semibold hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-void)]"
          >
            New Contest
          </button>
        </Link>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8">
          <Suspense fallback={<SkeletonKpiHero />}>
            <DashboardKpis stats={stats} />
          </Suspense>
        </div>
        <div className="col-span-12 lg:col-span-4">
          <DashboardLiveRail brandId={user.id} />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8">
          <DashboardChart data={stats.viewsOverTime} />
        </div>
        <div className="col-span-12 lg:col-span-4">
          <DashboardQuickActions contests={recentContests} />
        </div>
      </div>

      <RecentContestsTable contests={recentContests} />
    </div>
  );
}

