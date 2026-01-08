import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Activity, ArrowDownRight, ArrowUpRight, BarChart3, ClipboardList, Flame, Gauge, ScrollText, Sparkles } from 'lucide-react';

import { fetchAdminApi } from '@/lib/admin/request';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { formatCurrency, formatDateTime } from '@/lib/formatters';

import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminDashboardActionsClient } from '@/components/admin/admin-dashboard-actions-client';
import { AdminDashboardAnalytics } from '@/components/admin/admin-dashboard-analytics';
import { AdminEmptyStateGuided } from '@/components/admin/admin-empty-state-guided';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type DashboardReport = {
  generated_at: string;
  user_id: string;
  today: {
    views: { value: number; delta_day: number; delta_day_pct: number | null; delta_week: number; delta_week_pct: number | null };
    engagement: { value: number; delta_day: number; delta_day_pct: number | null; delta_week: number; delta_week_pct: number | null };
    new_users: { value: number; delta_day: number; delta_day_pct: number | null; delta_week: number; delta_week_pct: number | null };
    revenue_collected_cents: { value: number; delta_day: number; delta_day_pct: number | null; delta_week: number; delta_week_pct: number | null };
    pending_submissions: number;
    cashouts_pending: number;
    support_open: number;
  };
  todo: {
    my_work: {
      moderation_claimed: number;
      support_assigned_to_me: number;
      leads_assigned_to_me: number;
      moderation_unassigned: number;
      support_unassigned: number;
      leads_unassigned: number;
    };
    items: UnsafeAny[];
  };
  health: {
    webhooks_failed_1h: number;
    webhooks_failed_24h: number;
    ingestion_errors_1h: number;
    ingestion_errors_24h: number;
    ingestion_jobs_failed_7d: number;
    moderation_avg_review_minutes_7d: number | null;
    cashouts_avg_process_minutes_7d: number | null;
    support_avg_resolution_hours_7d: number | null;
  };
  marketing: {
    trending_contests: Array<{
      contest_id: string;
      title: string;
      status: string;
      total_views: number;
      total_weighted_views: number;
      total_submissions: number;
      total_creators: number;
    }>;
    brands_to_relaunch: Array<{
      brand_id: string;
      company_name: string;
      website: string | null;
      last_contest_updated: string | null;
    }>;
    top_creators: Array<{
      creator_id: string;
      label: string;
      total_views: number;
      total_earnings_cents: number;
      contests_participated: number;
      last_submission_updated: string | null;
    }>;
  };
  journal: {
    audit: UnsafeAny[];
    events: UnsafeAny[];
  };
  insights: Array<{ key: string; severity: 'info' | 'warning' | 'danger'; title: string; message: string; href: string }>;
};

const FALLBACK: DashboardReport = {
  generated_at: new Date().toISOString(),
  user_id: '',
  today: {
    views: { value: 0, delta_day: 0, delta_day_pct: null, delta_week: 0, delta_week_pct: null },
    engagement: { value: 0, delta_day: 0, delta_day_pct: null, delta_week: 0, delta_week_pct: null },
    new_users: { value: 0, delta_day: 0, delta_day_pct: null, delta_week: 0, delta_week_pct: null },
    revenue_collected_cents: { value: 0, delta_day: 0, delta_day_pct: null, delta_week: 0, delta_week_pct: null },
    pending_submissions: 0,
    cashouts_pending: 0,
    support_open: 0,
  },
  todo: {
    my_work: {
      moderation_claimed: 0,
      support_assigned_to_me: 0,
      leads_assigned_to_me: 0,
      moderation_unassigned: 0,
      support_unassigned: 0,
      leads_unassigned: 0,
    },
    items: [],
  },
  health: {
    webhooks_failed_1h: 0,
    webhooks_failed_24h: 0,
    ingestion_errors_1h: 0,
    ingestion_errors_24h: 0,
    ingestion_jobs_failed_7d: 0,
    moderation_avg_review_minutes_7d: null,
    cashouts_avg_process_minutes_7d: null,
    support_avg_resolution_hours_7d: null,
  },
  marketing: { trending_contests: [], brands_to_relaunch: [], top_creators: [] },
  journal: { audit: [], events: [] },
  insights: [],
};

function deltaBadge(delta: number, pct: number | null, label: string) {
  if (delta === 0) return <Badge variant="secondary">{label} : 0</Badge>;
  const up = delta > 0;
  const text = pct === null ? `${delta > 0 ? '+' : ''}${delta}` : `${delta > 0 ? '+' : ''}${pct}%`;
  return (
    <Badge variant={up ? 'success' : 'warning'}>
      {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
      {label} : {text}
    </Badge>
  );
}

function StatCard({
  title,
  value,
  badges,
  icon,
  action,
  footnote,
}: {
  title: string;
  value: string;
  badges?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  footnote?: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {icon ? <span className="text-muted-foreground">{icon}</span> : null}
            <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          </div>
          {action ? <div>{action}</div> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-2xl font-semibold">{value}</div>
        {badges ? <div className="flex flex-wrap gap-2">{badges}</div> : null}
        {footnote ? <div className="text-xs text-muted-foreground">{footnote}</div> : null}
      </CardContent>
    </Card>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
  actions,
  badges,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  badges?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl bg-muted/60 border border-border flex items-center justify-center">
          {icon}
        </div>
        <div>
          <div className="font-semibold">{title}</div>
          {subtitle ? <div className="text-sm text-muted-foreground">{subtitle}</div> : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {badges ? <div className="flex items-center gap-2">{badges}</div> : null}
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

export default async function AdminDashboardPage() {
  try {
    await requireAdminPermission('dashboard.read');
  } catch {
    redirect('/forbidden');
  }

  const res = await fetchAdminApi('/api/admin/dashboard/report', { cache: 'no-store' });
  const data: DashboardReport = res.ok ? await res.json() : FALLBACK;
  const insightCount = data.insights.length;
  const hasDangerInsights = data.insights.some((insight) => insight.severity === 'danger');
  const hasWarningInsights = data.insights.some((insight) => insight.severity === 'warning');
  const systemIssueCount =
    data.health.webhooks_failed_1h +
    data.health.webhooks_failed_24h +
    data.health.ingestion_errors_1h +
    data.health.ingestion_errors_24h +
    data.health.ingestion_jobs_failed_7d;
  const queueTotal = data.today.pending_submissions + data.today.cashouts_pending + data.today.support_open;
  const insightVariant = hasDangerInsights ? 'danger' : hasWarningInsights ? 'warning' : 'success';
  const insightLabel = insightCount > 0 ? `${insightCount} alerts` : 'All clear';

  return (
    <section className="space-y-8">
      <AdminPageHeader
        title="Tableau de bord"
        description="Centre de contrôle : où on en est • quoi traiter • action suivante."
        icon={<Gauge className="h-5 w-5" />}
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/app/admin/inbox">À traiter</Link>
            </Button>
            <Button asChild variant="secondary">
              <a href="/api/admin/audit/export?type=audit_logs&limit=1000">Export audit CSV</a>
            </Button>
          </>
        }
        badges={
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Maj : {formatDateTime(data.generated_at)}</Badge>
            <Badge variant={insightVariant}>{insightLabel}</Badge>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              Priority snapshot
              <Badge variant="secondary">Queue {queueTotal}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-border bg-muted/30 p-3">
              <div className="text-xs text-muted-foreground">Queue total</div>
              <div className="text-lg font-semibold">{queueTotal.toLocaleString()}</div>
              <Button asChild size="sm" variant="secondary" className="mt-2">
                <Link href="/app/admin/inbox">Open inbox</Link>
              </Button>
            </div>
            <div className="rounded-2xl border border-border bg-muted/30 p-3">
              <div className="text-xs text-muted-foreground">System issues</div>
              <div className="text-lg font-semibold">{systemIssueCount.toLocaleString()}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="secondary">
                  <Link href="/app/admin/integrations">Webhooks</Link>
                </Button>
                <Button asChild size="sm" variant="secondary">
                  <Link href="/app/admin/ingestion">Ingestion</Link>
                </Button>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-muted/30 p-3">
              <div className="text-xs text-muted-foreground">Insights</div>
              <div className="text-lg font-semibold">{insightCount.toLocaleString()}</div>
              <Button asChild size="sm" variant="secondary" className="mt-2">
                <Link href="/app/admin/inbox?kind=signals">View signals</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Quick actions
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            <div className="grid gap-2 md:grid-cols-2">
              <Button asChild variant="secondary">
                <Link href="/app/admin/contests/new">New contest</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/app/admin/moderation">Moderation queue</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/app/admin/submissions">Review submissions</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/app/admin/support">Support tickets</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/app/admin/finance">Finance review</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/app/admin/users?role=brand">Top brands</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 1) Aujourd'hui */}
      <div className="space-y-3">
        <SectionHeader
          icon={<BarChart3 className="h-5 w-5" />}
          title="Today"
          subtitle="Daily deltas vs D-1 and W-1"
          badges={
            <>
              <Badge variant="secondary">Queue {queueTotal}</Badge>
              <Badge variant={systemIssueCount > 0 ? 'warning' : 'success'}>
                {systemIssueCount > 0 ? 'Needs attention' : 'Stable'}
              </Badge>
            </>
          }
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Vues"
            value={data.today.views.value.toLocaleString()}
            icon={<BarChart3 className="h-4 w-4" />}
            badges={
              <>
                {deltaBadge(data.today.views.delta_day, data.today.views.delta_day_pct, 'J-1')}
                {deltaBadge(data.today.views.delta_week, data.today.views.delta_week_pct, 'S-1')}
              </>
            }
          />
          <StatCard
            title="Engagement"
            value={data.today.engagement.value.toLocaleString()}
            icon={<Activity className="h-4 w-4" />}
            badges={
              <>
                {deltaBadge(data.today.engagement.delta_day, data.today.engagement.delta_day_pct, 'J-1')}
                {deltaBadge(data.today.engagement.delta_week, data.today.engagement.delta_week_pct, 'S-1')}
              </>
            }
          />
          <StatCard
            title="Nouveaux utilisateurs"
            value={data.today.new_users.value.toLocaleString()}
            icon={<Flame className="h-4 w-4" />}
            badges={
              <>
                {deltaBadge(data.today.new_users.delta_day, data.today.new_users.delta_day_pct, 'J-1')}
                {deltaBadge(data.today.new_users.delta_week, data.today.new_users.delta_week_pct, 'S-1')}
              </>
            }
          />
          <StatCard
            title="Revenus collectés"
            value={formatCurrency(data.today.revenue_collected_cents.value, 'EUR')}
            icon={<Gauge className="h-4 w-4" />}
            badges={
              <>
                {deltaBadge(
                  data.today.revenue_collected_cents.delta_day,
                  data.today.revenue_collected_cents.delta_day_pct,
                  'J-1'
                )}
                {deltaBadge(
                  data.today.revenue_collected_cents.delta_week,
                  data.today.revenue_collected_cents.delta_week_pct,
                  'S-1'
                )}
              </>
            }
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            title="Soumissions en attente"
            value={data.today.pending_submissions.toLocaleString()}
            action={
              <Button asChild size="sm" variant="ghost">
                <Link href="/app/admin/submissions">Open</Link>
              </Button>
            }
          />
          <StatCard
            title="Cashouts en attente"
            value={data.today.cashouts_pending.toLocaleString()}
            action={
              <Button asChild size="sm" variant="ghost">
                <Link href="/app/admin/finance">Open</Link>
              </Button>
            }
          />
          <StatCard
            title="Tickets support (open/pending)"
            value={data.today.support_open.toLocaleString()}
            action={
              <Button asChild size="sm" variant="ghost">
                <Link href="/app/admin/support">Open</Link>
              </Button>
            }
          />
        </div>
      </div>

      {/* 2) À faire maintenant */}
      <div className="space-y-3">
        <SectionHeader
          icon={<ClipboardList className="h-5 w-5" />}
          title="Focus now"
          subtitle="Assigned work and quick triage"
          badges={
            <>
              <Badge variant="secondary">My work - Moderation {data.todo.my_work.moderation_claimed}</Badge>
              <Badge variant="secondary">My work - Support {data.todo.my_work.support_assigned_to_me}</Badge>
              <Badge variant="secondary">My work - CRM {data.todo.my_work.leads_assigned_to_me}</Badge>
            </>
          }
        />

        <Card>
          <CardContent className="pt-6">
            <AdminDashboardActionsClient items={data.todo.items as UnsafeAny} />
          </CardContent>
        </Card>
      </div>

      {/* 3) Santé système */}
      <div className="space-y-3">
        <SectionHeader
          icon={<Activity className="h-5 w-5" />}
          title="System health"
          subtitle="Ingestion, webhooks, files, processing time"
          badges={
            <>
              <Badge variant={systemIssueCount > 0 ? 'warning' : 'success'}>
                {systemIssueCount > 0 ? 'Needs attention' : 'Stable'}
              </Badge>
            </>
          }
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Webhooks échoués (1h)" value={data.health.webhooks_failed_1h.toLocaleString()} />
          <StatCard title="Webhooks échoués (24h)" value={data.health.webhooks_failed_24h.toLocaleString()} />
          <StatCard title="Erreurs ingestion (1h)" value={data.health.ingestion_errors_1h.toLocaleString()} />
          <StatCard title="Erreurs ingestion (24h)" value={data.health.ingestion_errors_24h.toLocaleString()} />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            title="Jobs ingestion en échec (7j)"
            value={data.health.ingestion_jobs_failed_7d.toLocaleString()}
          />
          <StatCard
            title="Modération • temps moyen (7j)"
            value={data.health.moderation_avg_review_minutes_7d === null ? '-' : `${data.health.moderation_avg_review_minutes_7d} min`}
          />
          <StatCard
            title="Finance • temps cashout (7j)"
            value={data.health.cashouts_avg_process_minutes_7d === null ? '-' : `${data.health.cashouts_avg_process_minutes_7d} min`}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            title="Support • temps moyen (7j)"
            value={data.health.support_avg_resolution_hours_7d === null ? '-' : `${data.health.support_avg_resolution_hours_7d} h`}
          />
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                Exports rapides
                <div className="flex items-center gap-2">
                  <Button asChild size="sm" variant="ghost">
                    <a href="/api/admin/audit/export?type=webhooks_stripe&limit=1000">Stripe webhooks CSV</a>
                  </Button>
                  <Button asChild size="sm" variant="ghost">
                    <a href="/api/admin/audit/export?type=status_history&limit=1000">Status history CSV</a>
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Export rapide des logs utiles pour diagnostiquer et suivre l&apos;activité.
            </CardContent>
          </Card>
        </div>

        {data.insights.length === 0 ? null : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <Flame className="h-5 w-5" />
                  Insights & recommandations
                </span>
                <Button asChild variant="secondary" size="sm">
                  <Link href="/app/admin/inbox?kind=signals">Voir signaux</Link>
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.insights.map((insight) => (
                <div key={insight.key} className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-muted/30 p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={insight.severity === 'danger' ? 'danger' : insight.severity === 'warning' ? 'warning' : 'info'}
                      >
                        {insight.severity}
                      </Badge>
                      <div className="font-medium truncate">{insight.title}</div>
                    </div>
                    <div className="text-sm text-muted-foreground">{insight.message}</div>
                  </div>
                  <Button asChild size="sm" variant="secondary">
                    <Link href={insight.href}>Ouvrir</Link>
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* 4) Marketing & croissance */}
      <div className="space-y-3">
        <SectionHeader
          icon={<Flame className="h-5 w-5" />}
          title="Marketing & growth"
          subtitle="Contests, relaunch targets, creator momentum"
        />

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                Concours en tendance
                <Button asChild size="sm" variant="secondary">
                  <Link href="/app/admin/contests">Voir</Link>
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {data.marketing.trending_contests.length === 0 ? (
                <div className="text-muted-foreground">Aucun concours.</div>
              ) : (
                data.marketing.trending_contests.map((c) => (
                  <div key={c.contest_id} className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{c.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {c.total_creators} créateurs • {c.total_submissions} soumissions
                      </div>
                    </div>
                    <Badge variant="secondary">{(c.total_views ?? 0).toLocaleString()} vues</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                Marques à relancer
                <Button asChild size="sm" variant="secondary">
                  <Link href="/app/admin/brands">Voir</Link>
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {data.marketing.brands_to_relaunch.length === 0 ? (
                <div className="text-muted-foreground">Aucune marque.</div>
              ) : (
                data.marketing.brands_to_relaunch.map((b) => (
                  <div key={b.brand_id} className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{b.company_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {b.last_contest_updated ? `Dernière activité : ${formatDateTime(b.last_contest_updated)}` : 'Aucune activité'}
                      </div>
                    </div>
                    <Button asChild size="sm" variant="primary">
                      <Link href={`/app/admin/contests/new?brand_id=${encodeURIComponent(b.brand_id)}`}>Créer concours</Link>
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                Top créateurs
                <Button asChild size="sm" variant="secondary">
                  <Link href="/app/admin/users?role=creator">Voir</Link>
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {data.marketing.top_creators.length === 0 ? (
                <div className="text-muted-foreground">Aucun créateur.</div>
              ) : (
                data.marketing.top_creators.map((c) => (
                  <div key={c.creator_id} className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{c.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {c.contests_participated} concours • {formatCurrency(c.total_earnings_cents, 'EUR')}
                      </div>
                    </div>
                    <Button asChild size="sm" variant="secondary">
                      <Link href={`/app/admin/users/${c.creator_id}`}>Profil</Link>
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 5) Journal */}
      <div className="space-y-3">
        <SectionHeader
          icon={<ScrollText className="h-5 w-5" />}
          title="Journal"
          subtitle="Admin actions and product events"
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                Audit (dernières actions)
                <div className="flex items-center gap-2">
                  <Button asChild size="sm" variant="secondary">
                    <Link href="/app/admin/audit">Voir</Link>
                  </Button>
                  <Button asChild size="sm" variant="ghost">
                    <a href="/api/admin/audit/export?type=audit_logs&limit=1000">CSV</a>
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {data.journal.audit.length === 0 ? (
                <AdminEmptyStateGuided title="Aucun audit" description="Aucune action récente." />
              ) : (
                data.journal.audit.map((row: UnsafeAny) => (
                  <div key={row.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{row.action}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {row.table_name} • {row.row_pk || '—'}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">{formatDateTime(row.created_at)}</div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                Event log (produit)
                <div className="flex items-center gap-2">
                  <Button asChild size="sm" variant="secondary">
                    <Link href="/app/admin/audit">Voir</Link>
                  </Button>
                  <Button asChild size="sm" variant="ghost">
                    <a href="/api/admin/audit/export?type=event_log&limit=1000">CSV</a>
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {data.journal.events.length === 0 ? (
                <AdminEmptyStateGuided title="Aucun événement" description="Aucun événement récent." />
              ) : (
                data.journal.events.map((row: UnsafeAny) => (
                  <div key={row.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{row.event_name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {row.user_id || row.org_id || '—'}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">{formatDateTime(row.created_at)}</div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 6) Analytics avancés */}
      <div className="space-y-3">
        <SectionHeader
          icon={<BarChart3 className="h-5 w-5" />}
          title="Advanced analytics"
          subtitle="Charts, funnel, cohorts"
        />

        <AdminDashboardAnalytics />
      </div>
    </section>
  );
}

