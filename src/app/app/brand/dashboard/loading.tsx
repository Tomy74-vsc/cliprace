import { SkeletonLine, SkeletonKpiHero, SkeletonKpi, SkeletonBlock, SkeletonTable } from '@/components/brand-ui';

export default function BrandDashboardLoading() {
  return (
    <div
      className="brand-scope max-w-7xl mx-auto px-6 py-8 space-y-6"
      aria-busy="true"
      aria-label="Loading dashboard"
    >
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <SkeletonLine width="160px" height="22px" />
          <SkeletonLine width="220px" height="14px" />
        </div>
        <SkeletonBlock width="120px" height="36px" rounded="var(--r2)" />
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8 space-y-4">
          <SkeletonKpiHero />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SkeletonKpi />
            <SkeletonKpi />
            <SkeletonKpi />
            <SkeletonKpi />
          </div>
        </div>
        <div className="col-span-12 lg:col-span-4">
          <SkeletonBlock height="320px" />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8">
          <SkeletonBlock height="260px" />
        </div>
        <div className="col-span-12 lg:col-span-4">
          <SkeletonBlock height="260px" />
        </div>
      </div>

      <SkeletonTable rows={5} cols={5} />
    </div>
  );
}

