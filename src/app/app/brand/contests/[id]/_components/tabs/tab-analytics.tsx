"use client";

import { Eye, Heart, MessageCircle, Share2 } from "lucide-react";
import { Panel, EmptyState, Surface } from "@/components/brand-ui";
import type { ContestMetrics } from '../../_types';
import { AnalyticsDistributionChart } from './tab-analytics-distribution';

interface TabAnalyticsProps {
  metrics: ContestMetrics | null;
}

export function TabAnalytics({ metrics }: TabAnalyticsProps) {
  const hasAny =
    metrics &&
    (metrics.totalViews > 0 ||
      metrics.totalLikes > 0 ||
      metrics.totalComments > 0 ||
      metrics.totalShares > 0);

  if (!metrics || !hasAny) {
    return (
      <Panel
        title="Analytics"
        description="Analytics will appear once your contest gets traction."
      >
        <EmptyState
          title="No data yet"
          description="Analytics will appear once your contest gets traction."
        />
      </Panel>
    );
  }

  const engagementCards = [
    {
      key: 'Views',
      value: metrics.totalViews,
      icon: Eye,
    },
    {
      key: 'Likes',
      value: metrics.totalLikes,
      icon: Heart,
    },
    {
      key: 'Comments',
      value: metrics.totalComments,
      icon: MessageCircle,
    },
    {
      key: 'Shares',
      value: metrics.totalShares,
      icon: Share2,
    },
  ];

  const interactions =
    metrics.totalLikes + metrics.totalComments + metrics.totalShares;

  const engagementRate =
    metrics.totalViews > 0
      ? ((interactions / metrics.totalViews) * 100).toFixed(2)
      : null;

  const approvalRate =
    metrics.totalSubmissions > 0
      ? (
          (metrics.approvedSubmissions / metrics.totalSubmissions) *
          100
        ).toFixed(1)
      : null;

  const avgViewsPerApproved =
    metrics.approvedSubmissions > 0
      ? Math.round(metrics.totalViews / metrics.approvedSubmissions)
      : null;

  return (
    <div className="space-y-6">
      <Panel
        title="Engagement breakdown"
        description="High-level engagement metrics for this campaign."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {engagementCards.map((item) => (
            <Surface key={item.key} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]">
                    {item.key}
                  </p>
                  <p className="mt-1 text-[28px] font-semibold tabular-nums text-[var(--text-1)] leading-tight">
                    {item.value.toLocaleString('en-US')}
                  </p>
                </div>
                <item.icon className="h-5 w-5 text-[var(--accent)]" />
              </div>
            </Surface>
          ))}
        </div>
      </Panel>

      <Panel
        title="Performance ratios"
        description="Key efficiency metrics for this contest."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <Surface className="p-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]">
              Engagement rate
            </p>
            <p className="mt-1 text-[26px] font-semibold tabular-nums text-[var(--text-1)] leading-tight">
              {engagementRate ? `${engagementRate}%` : '—'}
            </p>
            <p className="mt-1 text-[11px] text-[var(--text-3)]">
              (likes + comments + shares) / views
            </p>
          </Surface>
          <Surface className="p-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]">
              Approval rate
            </p>
            <p className="mt-1 text-[26px] font-semibold tabular-nums text-[var(--text-1)] leading-tight">
              {approvalRate ? `${approvalRate}%` : '—'}
            </p>
            <p className="mt-1 text-[11px] text-[var(--text-3)]">
              Approved submissions vs. total submissions
            </p>
          </Surface>
          <Surface className="p-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]">
              Avg views / approved submission
            </p>
            <p className="mt-1 text-[26px] font-semibold tabular-nums text-[var(--text-1)] leading-tight">
              {avgViewsPerApproved !== null
                ? avgViewsPerApproved.toLocaleString('en-US')
                : '—'}
            </p>
            <p className="mt-1 text-[11px] text-[var(--text-3)]">
              Average views for each approved creator video
            </p>
          </Surface>
        </div>
      </Panel>

      <Panel
        title="Distribution"
        description="Relative weight of each engagement signal."
      >
        <AnalyticsDistributionChart
          metrics={{
            totalViews: metrics.totalViews,
            totalLikes: metrics.totalLikes,
            totalComments: metrics.totalComments,
            totalShares: metrics.totalShares,
          }}
        />
      </Panel>
    </div>
  );
}

