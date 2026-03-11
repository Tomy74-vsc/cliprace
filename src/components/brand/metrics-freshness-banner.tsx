import { Clock } from 'lucide-react';

interface MetricsFreshnessBannerProps {
  hasRealMetrics: boolean;
  approvedSubmissionsCount: number;
}

export function MetricsFreshnessBanner({
  hasRealMetrics,
  approvedSubmissionsCount,
}: MetricsFreshnessBannerProps) {
  if (hasRealMetrics || approvedSubmissionsCount === 0) return null;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-600 dark:text-amber-400">
      <Clock className="h-4 w-4 shrink-0" />
      <p>
        <span className="font-medium">Métriques en cours de calcul.</span>{' '}
        Les vues et le leaderboard seront disponibles dans quelques minutes après validation des soumissions.
      </p>
    </div>
  );
}

