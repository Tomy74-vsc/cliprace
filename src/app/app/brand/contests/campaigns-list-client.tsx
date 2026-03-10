'use client';

/**
 * CampaignsListClient — Client island for the campaigns list page.
 *
 * Handles:
 * - Local search / status filter / sort (instant, no page reload)
 * - Desktop: finance-grade table in GlassCard
 * - Mobile: compact card list + BrandDrawer preview
 * - Row actions via Radix DropdownMenu (View, Edit, Duplicate, Publish, Close)
 * - ActionDialog for dangerous mutations (Publish / Close)
 * - CSRF on all mutations via useCsrfToken
 * - Sonner toasts for feedback
 */
import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  MoreHorizontal,
  Eye,
  Pencil,
  Copy,
  Rocket,
  XCircle,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { GlassCard, BrandInput, ActionDialog, BrandDrawer } from '@/components/brand-ui';
import {
  StatusBadge,
  contestStatusVariant,
  contestStatusLabel,
} from '@/components/brand-ui/StatusBadge';
import { useBrandPortalContainer } from '@/components/brand-ui/use-brand-portal';
import { useCsrfToken } from '@/hooks/use-csrf-token';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { BrandEmptyState } from '@/components/brand/empty-state-enhanced';

/* ─── Types ─── */

export interface CampaignRow {
  id: string;
  title: string;
  status: string;
  prize_pool_cents: number;
  currency: string;
  networks: string[];
  start_at: string;
  end_at: string;
  submissions_count: number;
  pending_submissions_count: number;
  views: number;
  created_at: string;
}

interface CampaignsListClientProps {
  contests: CampaignRow[];
  stats: { active: number; draft: number; ended: number };
}

/* ─── Constants ─── */

const STATUS_FILTERS = [
  { key: 'all', label: 'Tous' },
  { key: 'active', label: 'Live' },
  { key: 'draft', label: 'Brouillons' },
  { key: 'ended', label: 'Terminées' },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]['key'];

const SORT_OPTIONS = [
  { key: 'newest', label: 'Plus récentes' },
  { key: 'views', label: 'Vues' },
  { key: 'budget', label: 'Budget' },
] as const;

type SortOption = (typeof SORT_OPTIONS)[number]['key'];

/* ─── Helpers ─── */

function formatCpv(
  prizePoolCents: number,
  views: number,
  currency: string,
): string {
  if (views === 0) return '–';
  const cpv = prizePoolCents / 100 / views;
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: (currency || 'EUR').toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cpv);
}

function formatViews(views: number): string {
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1)}K`;
  return views.toLocaleString('fr-FR');
}

/* ─── Main Component ─── */

export function CampaignsListClient({
  contests,
  stats,
}: CampaignsListClientProps) {
  const router = useRouter();
  const csrfToken = useCsrfToken();
  const portalContainer = useBrandPortalContainer();

  /* Filter / sort state */
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  /* Dialog / drawer state */
  const [selectedContest, setSelectedContest] =
    useState<CampaignRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [publishDialog, setPublishDialog] = useState<{
    open: boolean;
    id: string | null;
  }>({ open: false, id: null });
  const [closeDialog, setCloseDialog] = useState<{
    open: boolean;
    id: string | null;
  }>({ open: false, id: null });
  const [actionLoading, setActionLoading] = useState(false);

  /* Computed: filter + sort */
  const filteredContests = useMemo(() => {
    let result = [...contests];

    // Search by title
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter((c) => c.title.toLowerCase().includes(q));
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((c) => c.status === statusFilter);
    }

    // Sort
    switch (sortBy) {
      case 'newest':
        result.sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime(),
        );
        break;
      case 'views':
        result.sort((a, b) => b.views - a.views);
        break;
      case 'budget':
        result.sort((a, b) => b.prize_pool_cents - a.prize_pool_cents);
        break;
    }

    return result;
  }, [contests, search, statusFilter, sortBy]);

  /* Filter counts */
  const filterCounts: Record<StatusFilter, number> = {
    all: contests.length,
    active: stats.active,
    draft: stats.draft,
    ended: stats.ended,
  };

  const currentSortLabel =
    SORT_OPTIONS.find((o) => o.key === sortBy)?.label || 'Trier';

  /* ─── Mutation handlers (CSRF-protected) ─── */

  const handlePublish = useCallback(async () => {
    if (!publishDialog.id || !csrfToken) return;
    setActionLoading(true);
    try {
      const res = await fetch(
        `/api/contests/${publishDialog.id}/publish`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf': csrfToken,
          },
          credentials: 'include',
          body: JSON.stringify({}),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Erreur');
      toast.success('Campagne publiée');
      router.refresh();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Erreur lors de la publication',
      );
    } finally {
      setActionLoading(false);
      setPublishDialog({ open: false, id: null });
    }
  }, [publishDialog.id, csrfToken, router]);

  const handleClose = useCallback(async () => {
    if (!closeDialog.id || !csrfToken) return;
    setActionLoading(true);
    try {
      const res = await fetch(
        `/api/contests/${closeDialog.id}/close`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf': csrfToken,
          },
          credentials: 'include',
          body: JSON.stringify({}),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Erreur');
      toast.success('Campagne clôturée');
      router.refresh();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Erreur lors de la clôture',
      );
    } finally {
      setActionLoading(false);
      setCloseDialog({ open: false, id: null });
    }
  }, [closeDialog.id, csrfToken, router]);

  const handleDuplicate = useCallback(
    async (contestId: string) => {
      if (!csrfToken) {
        toast.error('Token CSRF manquant. Rechargez la page.');
        return;
      }
      try {
        const res = await fetch(
          `/api/contests/${contestId}/duplicate`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-csrf': csrfToken,
            },
            credentials: 'include',
          },
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || 'Erreur');
        toast.success('Campagne dupliquée');
        router.push(`/app/brand/contests/${json.contest_id}/edit`);
      } catch (e) {
        toast.error(
          e instanceof Error
            ? e.message
            : 'Erreur lors de la duplication',
        );
      }
    },
    [csrfToken, router],
  );

  /* ─── No contests at all → empty state ─── */
  if (contests.length === 0) {
    return (
      <BrandEmptyState
        type="no-contests"
        title="Prêt à lancer votre première campagne ?"
        description="Créez un concours pour recevoir du contenu créatif de la communauté."
        action={{
          label: 'Créer un concours',
          href: '/app/brand/contests/new',
          variant: 'primary',
        }}
      />
    );
  }

  /* ─── Render ─── */
  return (
    <>
      {/* ── KPI Chips ── */}
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-[var(--r-pill)] border border-[var(--brand-success)]/20 bg-[var(--brand-success)]/8 px-3 py-1 text-xs font-medium text-[var(--brand-success)]">
          <span
            className="h-1.5 w-1.5 rounded-full bg-[var(--brand-success)] motion-safe:animate-pulse"
            aria-hidden="true"
          />
          Live : {stats.active}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-[var(--r-pill)] border border-[var(--border-1)] bg-[var(--surface-2)]/50 px-3 py-1 text-xs font-medium text-[var(--text-2)]">
          Brouillons : {stats.draft}
        </span>
      </div>

      {/* ── Filters Row ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="w-full sm:max-w-xs">
          <BrandInput
            startIcon={Search}
            placeholder="Rechercher une campagne…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Rechercher une campagne"
          />
        </div>

        <div className="flex items-center gap-3 overflow-x-auto">
          {/* Status Segmented Control */}
          <div
            className="flex items-center rounded-[var(--r2)] border border-[var(--border-1)] bg-[var(--surface-1)] p-0.5"
            role="tablist"
            aria-label="Filtrer par statut"
          >
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={statusFilter === f.key}
                onClick={() => setStatusFilter(f.key)}
                className={cn(
                  'rounded-[calc(var(--r2)-2px)] px-3 py-1.5 text-xs font-medium transition-all',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)]',
                  statusFilter === f.key
                    ? 'bg-[var(--surface-2)] text-[var(--text-1)] shadow-sm'
                    : 'text-[var(--text-3)] hover:text-[var(--text-2)]',
                )}
              >
                {f.label}
                <span className="ml-1 text-[10px] opacity-60 tabular-nums">
                  {filterCounts[f.key]}
                </span>
              </button>
            ))}
          </div>

          {/* Sort Dropdown */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-[var(--r2)] border border-[var(--border-1)] bg-[var(--surface-1)] px-3 py-2 text-xs font-medium text-[var(--text-2)]',
                  'transition-colors hover:border-[var(--border-2)] hover:text-[var(--text-1)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)]',
                )}
                aria-label="Trier par"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                {currentSortLabel}
                <ChevronDown className="h-3 w-3 opacity-50" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal container={portalContainer}>
              <DropdownMenu.Content
                className="z-50 min-w-[140px] rounded-[var(--r2)] border border-[var(--border-1)] bg-[var(--surface-2)] p-1 shadow-[var(--shadow-brand-2)]"
                sideOffset={4}
                align="end"
              >
                {SORT_OPTIONS.map((o) => (
                  <DropdownMenu.Item
                    key={o.key}
                    className={cn(
                      'cursor-pointer rounded-sm px-2.5 py-1.5 text-xs outline-none transition-colors',
                      'hover:bg-[var(--surface-3)] focus:bg-[var(--surface-3)]',
                      sortBy === o.key
                        ? 'text-[var(--text-1)] font-medium'
                        : 'text-[var(--text-2)]',
                    )}
                    onSelect={() => setSortBy(o.key)}
                  >
                    {o.label}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>

      {/* ── Results ── */}
      {filteredContests.length === 0 ? (
        /* Filtered empty state */
        <GlassCard className="py-16 text-center">
          <p className="text-sm text-[var(--text-2)]">
            Aucune campagne ne correspond à vos filtres.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setStatusFilter('all');
            }}
            className="mt-3 text-xs font-medium text-[var(--brand-accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] rounded"
          >
            Réinitialiser les filtres
          </button>
        </GlassCard>
      ) : (
        <>
          {/* ── Desktop: Finance-grade Table ── */}
          <div className="hidden lg:block">
            <GlassCard className="overflow-hidden p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border-1)]">
                    <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-[var(--text-3)]">
                      Campagne
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-[var(--text-3)]">
                      Statut
                    </th>
                    <th className="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-wider text-[var(--text-3)]">
                      Vues
                    </th>
                    <th className="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-wider text-[var(--text-3)]">
                      Budget
                    </th>
                    <th className="hidden xl:table-cell px-4 py-3 text-right text-[11px] font-medium uppercase tracking-wider text-[var(--text-3)]">
                      CPV
                    </th>
                    <th className="px-4 py-3 text-center text-[11px] font-medium uppercase tracking-wider text-[var(--text-3)]">
                      En attente
                    </th>
                    <th className="w-12 px-2 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-1)]">
                  {filteredContests.map((contest) => (
                    <tr
                      key={contest.id}
                      className="group cursor-pointer transition-colors hover:bg-[var(--surface-2)]/40"
                      onClick={() =>
                        router.push(
                          `/app/brand/contests/${contest.id}`,
                        )
                      }
                      role="link"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter')
                          router.push(
                            `/app/brand/contests/${contest.id}`,
                          );
                      }}
                    >
                      {/* Campaign */}
                      <td className="px-4 py-3.5 max-w-[260px]">
                        <p className="truncate text-sm font-medium text-[var(--text-1)]">
                          {contest.title}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[var(--text-3)]">
                          {formatDate(contest.created_at)}
                        </p>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <StatusBadge
                          variant={contestStatusVariant(contest.status)}
                          label={contestStatusLabel(contest.status)}
                          pulse={contest.status === 'active'}
                        />
                      </td>

                      {/* Views */}
                      <td className="px-4 py-3.5 text-right text-sm tabular-nums text-[var(--text-1)]">
                        {formatViews(contest.views)}
                      </td>

                      {/* Budget */}
                      <td className="px-4 py-3.5 text-right text-sm tabular-nums text-[var(--text-1)]">
                        {formatCurrency(
                          contest.prize_pool_cents,
                          contest.currency,
                        )}
                      </td>

                      {/* CPV (hidden on < xl) */}
                      <td className="hidden xl:table-cell px-4 py-3.5 text-right text-sm tabular-nums text-[var(--text-2)]">
                        {formatCpv(
                          contest.prize_pool_cents,
                          contest.views,
                          contest.currency,
                        )}
                      </td>

                      {/* Pending */}
                      <td className="px-4 py-3.5 text-center">
                        {contest.pending_submissions_count > 0 ? (
                          <span className="inline-flex items-center rounded-[var(--r-pill)] bg-[var(--brand-warning)]/12 px-2 py-0.5 text-xs font-medium tabular-nums text-[var(--brand-warning)]">
                            {contest.pending_submissions_count}
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--text-3)]">
                            –
                          </span>
                        )}
                      </td>

                      {/* Actions (stops row click propagation) */}
                      <td
                        className="px-2 py-3.5"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <RowActions
                          contest={contest}
                          portalContainer={portalContainer}
                          onPublish={() =>
                            setPublishDialog({
                              open: true,
                              id: contest.id,
                            })
                          }
                          onClose={() =>
                            setCloseDialog({
                              open: true,
                              id: contest.id,
                            })
                          }
                          onDuplicate={() =>
                            handleDuplicate(contest.id)
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </GlassCard>

            {/* Result count */}
            <p className="mt-3 text-xs text-[var(--text-3)]">
              {filteredContests.length} campagne
              {filteredContests.length > 1 ? 's' : ''}
              {statusFilter !== 'all' || search
                ? ' (filtrées)'
                : ''}
            </p>
          </div>

          {/* ── Mobile: Compact Card List ── */}
          <div className="lg:hidden space-y-2">
            {filteredContests.map((contest) => (
              <button
                key={contest.id}
                type="button"
                className={cn(
                  'w-full rounded-[var(--r3)] border border-[var(--border-1)] bg-[var(--surface-1)]/80 p-4 text-left',
                  'transition-all hover:border-[var(--border-2)] hover:bg-[var(--surface-2)]/40',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)]',
                )}
                onClick={() => {
                  setSelectedContest(contest);
                  setDrawerOpen(true);
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--text-1)]">
                      {contest.title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[var(--text-3)]">
                      {formatDate(contest.created_at)} ·{' '}
                      {formatCurrency(
                        contest.prize_pool_cents,
                        contest.currency,
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {contest.pending_submissions_count > 0 && (
                      <span className="inline-flex items-center rounded-[var(--r-pill)] bg-[var(--brand-warning)]/12 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-[var(--brand-warning)]">
                        {contest.pending_submissions_count}
                      </span>
                    )}
                    <StatusBadge
                      variant={contestStatusVariant(contest.status)}
                      label={contestStatusLabel(contest.status)}
                      pulse={contest.status === 'active'}
                    />
                    <ChevronRight className="h-4 w-4 text-[var(--text-3)]" />
                  </div>
                </div>
              </button>
            ))}
            <p className="pt-1 text-xs text-[var(--text-3)]">
              {filteredContests.length} campagne
              {filteredContests.length > 1 ? 's' : ''}
            </p>
          </div>
        </>
      )}

      {/* ── Mobile Drawer ── */}
      <BrandDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title={selectedContest?.title || ''}
        description={
          selectedContest
            ? contestStatusLabel(selectedContest.status)
            : ''
        }
      >
        {selectedContest && (
          <div className="space-y-6">
            {/* KPIs grid */}
            <div className="grid grid-cols-2 gap-3">
              <KpiMini label="Vues" value={formatViews(selectedContest.views)} />
              <KpiMini
                label="Budget"
                value={formatCurrency(
                  selectedContest.prize_pool_cents,
                  selectedContest.currency,
                )}
              />
              <KpiMini
                label="CPV"
                value={formatCpv(
                  selectedContest.prize_pool_cents,
                  selectedContest.views,
                  selectedContest.currency,
                )}
              />
              <KpiMini
                label="En attente"
                value={String(selectedContest.pending_submissions_count)}
              />
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <Link
                href={`/app/brand/contests/${selectedContest.id}`}
                className="flex w-full items-center gap-2 rounded-[var(--r2)] bg-[var(--cta-bg)] px-4 py-2.5 text-sm font-medium text-[var(--cta-fg)] transition-colors hover:bg-white/90"
              >
                <Eye className="h-4 w-4" />
                Voir la campagne
              </Link>

              {selectedContest.status === 'draft' && (
                <>
                  <Link
                    href={`/app/brand/contests/${selectedContest.id}/edit`}
                    className="flex w-full items-center gap-2 rounded-[var(--r2)] border border-[var(--border-1)] px-4 py-2.5 text-sm font-medium text-[var(--text-2)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text-1)]"
                  >
                    <Pencil className="h-4 w-4" />
                    Modifier
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setDrawerOpen(false);
                      setPublishDialog({
                        open: true,
                        id: selectedContest.id,
                      });
                    }}
                    className="flex w-full items-center gap-2 rounded-[var(--r2)] border border-[var(--brand-success)]/30 bg-[var(--brand-success)]/8 px-4 py-2.5 text-sm font-medium text-[var(--brand-success)] transition-colors hover:bg-[var(--brand-success)]/15"
                  >
                    <Rocket className="h-4 w-4" />
                    Publier
                  </button>
                </>
              )}

              {selectedContest.status === 'active' && (
                <button
                  type="button"
                  onClick={() => {
                    setDrawerOpen(false);
                    setCloseDialog({
                      open: true,
                      id: selectedContest.id,
                    });
                  }}
                  className="flex w-full items-center gap-2 rounded-[var(--r2)] border border-[var(--brand-danger)]/30 bg-[var(--brand-danger)]/8 px-4 py-2.5 text-sm font-medium text-[var(--brand-danger)] transition-colors hover:bg-[var(--brand-danger)]/15"
                >
                  <XCircle className="h-4 w-4" />
                  Clôturer
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false);
                  handleDuplicate(selectedContest.id);
                }}
                className="flex w-full items-center gap-2 rounded-[var(--r2)] border border-[var(--border-1)] px-4 py-2.5 text-sm font-medium text-[var(--text-2)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text-1)]"
              >
                <Copy className="h-4 w-4" />
                Dupliquer
              </button>
            </div>
          </div>
        )}
      </BrandDrawer>

      {/* ── Publish Confirmation ── */}
      <ActionDialog
        open={publishDialog.open}
        onOpenChange={(open) =>
          setPublishDialog({ ...publishDialog, open })
        }
        title="Publier la campagne ?"
        description="La campagne sera visible par tous les créateurs. Vous pourrez la clôturer à tout moment."
        confirmLabel="Publier"
        onConfirm={handlePublish}
        loading={actionLoading}
      />

      {/* ── Close Confirmation (danger) ── */}
      <ActionDialog
        open={closeDialog.open}
        onOpenChange={(open) =>
          setCloseDialog({ ...closeDialog, open })
        }
        title="Clôturer la campagne ?"
        description="Les créateurs ne pourront plus soumettre de participations. Cette action est irréversible."
        confirmLabel="Clôturer"
        onConfirm={handleClose}
        loading={actionLoading}
        intent="danger"
      />
    </>
  );
}

/* ─── KpiMini (drawer) ─── */

function KpiMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--r2)] bg-[var(--surface-2)]/60 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-3)]">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--text-1)]">
        {value}
      </p>
    </div>
  );
}

/* ─── RowActions (desktop kebab dropdown) ─── */

function RowActions({
  contest,
  portalContainer,
  onPublish,
  onClose,
  onDuplicate,
}: {
  contest: CampaignRow;
  portalContainer: HTMLElement | undefined;
  onPublish: () => void;
  onClose: () => void;
  onDuplicate: () => void;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={cn(
            'rounded-lg p-1.5 text-[var(--text-3)] transition-colors',
            'hover:bg-[var(--surface-2)] hover:text-[var(--text-1)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)]',
            'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
          )}
          aria-label={`Actions pour ${contest.title}`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal container={portalContainer}>
        <DropdownMenu.Content
          className="z-50 min-w-[160px] rounded-[var(--r2)] border border-[var(--border-1)] bg-[var(--surface-2)] p-1 shadow-[var(--shadow-brand-2)]"
          sideOffset={4}
          align="end"
        >
          {/* View */}
          <DropdownMenu.Item asChild>
            <Link
              href={`/app/brand/contests/${contest.id}`}
              className="flex cursor-pointer items-center gap-2 rounded-sm px-2.5 py-1.5 text-xs text-[var(--text-2)] outline-none transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text-1)] focus:bg-[var(--surface-3)] focus:text-[var(--text-1)]"
            >
              <Eye className="h-3.5 w-3.5" />
              Voir
            </Link>
          </DropdownMenu.Item>

          {/* Edit (draft only) */}
          {contest.status === 'draft' && (
            <DropdownMenu.Item asChild>
              <Link
                href={`/app/brand/contests/${contest.id}/edit`}
                className="flex cursor-pointer items-center gap-2 rounded-sm px-2.5 py-1.5 text-xs text-[var(--text-2)] outline-none transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text-1)] focus:bg-[var(--surface-3)] focus:text-[var(--text-1)]"
              >
                <Pencil className="h-3.5 w-3.5" />
                Modifier
              </Link>
            </DropdownMenu.Item>
          )}

          {/* Duplicate */}
          <DropdownMenu.Item
            className="flex cursor-pointer items-center gap-2 rounded-sm px-2.5 py-1.5 text-xs text-[var(--text-2)] outline-none transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text-1)] focus:bg-[var(--surface-3)] focus:text-[var(--text-1)]"
            onSelect={(e) => {
              e.preventDefault();
              onDuplicate();
            }}
          >
            <Copy className="h-3.5 w-3.5" />
            Dupliquer
          </DropdownMenu.Item>

          {/* Publish (draft only) */}
          {contest.status === 'draft' && (
            <>
              <DropdownMenu.Separator className="my-1 h-px bg-[var(--border-1)]" />
              <DropdownMenu.Item
                className="flex cursor-pointer items-center gap-2 rounded-sm px-2.5 py-1.5 text-xs text-[var(--brand-success)] outline-none transition-colors hover:bg-[var(--brand-success)]/10 focus:bg-[var(--brand-success)]/10"
                onSelect={(e) => {
                  e.preventDefault();
                  onPublish();
                }}
              >
                <Rocket className="h-3.5 w-3.5" />
                Publier
              </DropdownMenu.Item>
            </>
          )}

          {/* Close (active only) */}
          {contest.status === 'active' && (
            <>
              <DropdownMenu.Separator className="my-1 h-px bg-[var(--border-1)]" />
              <DropdownMenu.Item
                className="flex cursor-pointer items-center gap-2 rounded-sm px-2.5 py-1.5 text-xs text-[var(--brand-danger)] outline-none transition-colors hover:bg-[var(--brand-danger)]/10 focus:bg-[var(--brand-danger)]/10"
                onSelect={(e) => {
                  e.preventDefault();
                  onClose();
                }}
              >
                <XCircle className="h-3.5 w-3.5" />
                Clôturer
              </DropdownMenu.Item>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
