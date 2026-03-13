import { Kpi, KpiHero, Panel, StatusBadge, Surface } from '@/components/brand-ui';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import type { ContestDetail, ContestMetrics } from '../../_types';

interface TabOverviewProps {
  contest: ContestDetail;
  metrics: ContestMetrics;
}

export function TabOverview({ contest, metrics }: TabOverviewProps) {
  return (
    <div className="space-y-6">
      {/* Row 1 — KPI strip */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi
          label="Total views"
          value={metrics.totalViews}
          format="number"
        />
        <Kpi
          label="Submissions"
          value={metrics.totalSubmissions}
          format="number"
        />
        <Kpi
          label="Approved"
          value={metrics.approvedSubmissions}
          format="number"
        />
        <Kpi
          label="Creators"
          value={metrics.totalCreators}
          format="number"
        />
      </div>

      {/* Row 2 — KpiHero + Budget breakdown */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <KpiHero
            label="Weighted views"
            value={metrics.totalWeightedViews}
            format="number"
            beam
          />
        </div>
        <div className="lg:col-span-4">
          <Panel title="Budget">
            <Surface variant="notched" className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]">
                    Prize pool
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[var(--text-1)] tabular-nums">
                    {formatCurrency(metrics.budgetSpentCents + metrics.budgetRemainingCents, contest.currency)}
                  </p>
                </div>
                <StatusBadge status={contest.status} />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-[var(--text-3)]">
                  <span>Budget spent</span>
                  <span className="tabular-nums text-[var(--text-2)]">
                    {formatCurrency(metrics.budgetSpentCents, contest.currency)}
                  </span>
                </div>
                <div className="flex h-1.5 overflow-hidden rounded-[999px] bg-[var(--surface-2)]">
                  {(() => {
                    const total = metrics.budgetSpentCents + metrics.budgetRemainingCents;
                    const ratio = total > 0 ? metrics.budgetSpentCents / total : 0;
                    const clamped = Math.min(1, Math.max(0, ratio));
                    // eslint-disable-next-line react/forbid-dom-props
                    return (
                      <div
                        className="h-full rounded-[999px] bg-[var(--accent)]"
                        style={{ width: `${clamped * 100}%` }}
                      />
                    );
                  })()}
                </div>
                <div className="flex items-center justify-between text-[11px] text-[var(--text-3)]">
                  <span>Remaining</span>
                  <span className="tabular-nums text-[var(--text-2)]">
                    {formatCurrency(metrics.budgetRemainingCents, contest.currency)}
                  </span>
                </div>
              </div>

              <div className="pt-1 text-[11px] text-[var(--text-3)]">
                {metrics.cpv != null ? (
                  <span className="tabular-nums">
                    ~{formatCurrency(metrics.cpv, contest.currency)} per view
                  </span>
                ) : (
                  <span>CPV will appear once views are recorded.</span>
                )}
              </div>
            </Surface>
          </Panel>
        </div>
      </div>

      {/* Row 3 — Brief */}
      {contest.briefMd && (
        <Panel title="Brief">
          <ReactMarkdown
            rehypePlugins={[rehypeSanitize]}
            className="text-[14px] text-[var(--text-2)] leading-relaxed
        [&_h2]:text-[var(--text-1)] [&_h2]:font-semibold [&_h2]:text-[16px] [&_h2]:mb-2
        [&_strong]:text-[var(--text-1)]
        [&_a]:text-[var(--accent)] [&_a]:underline
        [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:space-y-1
        [&_p]:mb-3"
          >
            {contest.briefMd}
          </ReactMarkdown>
        </Panel>
      )}
    </div>
  );
}

function formatCurrency(amountCents: number, currency: string) {
  const amount = amountCents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'EUR',
    maximumFractionDigits: 2,
  }).format(amount);
}

