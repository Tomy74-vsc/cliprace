'use client';

/**
 * CampaignSelector — Radix Popover campaign picker (UI-only).
 *
 * Features:
 * - Trigger styled as a compact "select" button (Layers icon + label + chevron).
 * - Popover content inside brand-portal-root (inherits Ink tokens).
 * - Local search input (filters placeholder items).
 * - Sections: Actives / Brouillons / Terminées.
 * - Click selects item, updates trigger label, closes popover.
 * - A11y: keyboard nav, escape close, focus ring Race Light.
 * - Reduced motion support.
 *
 * No backend interaction — purely presentational.
 */
import { useState, useMemo } from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Layers, ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBrandPortalContainer } from './use-brand-portal';

/* ── Types ── */
type CampaignStatus = 'active' | 'draft' | 'closed';

interface CampaignItem {
  id: string;
  name: string;
  status: CampaignStatus;
  budget: string;
}

/* ── Placeholder data ── */
const PLACEHOLDER_CAMPAIGNS: CampaignItem[] = [
  { id: '1', name: 'Campagne TikTok — Février', status: 'active', budget: '2 500 €' },
  { id: '2', name: 'UGC Challenge Printemps', status: 'active', budget: '5 000 €' },
  { id: '3', name: 'Lancement Produit Q2', status: 'draft', budget: '3 000 €' },
  { id: '4', name: 'Back to School 2025', status: 'closed', budget: '4 200 €' },
  { id: '5', name: 'Holiday Special', status: 'closed', budget: '6 000 €' },
];

const ALL_LABEL = 'Toutes les campagnes';

/* ── Status helpers ── */
function statusLabel(status: CampaignStatus): string {
  switch (status) {
    case 'active': return 'Live';
    case 'draft': return 'Brouillon';
    case 'closed': return 'Terminée';
  }
}

function statusClasses(status: CampaignStatus): string {
  switch (status) {
    case 'active':
      return 'bg-[var(--brand-accent)]/15 text-[var(--brand-accent)] border-[var(--brand-accent)]/20';
    case 'draft':
      return 'bg-[var(--brand-warning)]/15 text-[var(--brand-warning)] border-[var(--brand-warning)]/20';
    case 'closed':
      return 'bg-[var(--surface-2)] text-[var(--text-3)] border-[var(--border-1)]';
  }
}

/* ── Section config ── */
const SECTIONS: { key: CampaignStatus; label: string }[] = [
  { key: 'active', label: 'Actives' },
  { key: 'draft', label: 'Brouillons' },
  { key: 'closed', label: 'Terminées' },
];

/* ── Component ── */
export function CampaignSelector() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<CampaignItem | null>(null);
  const [search, setSearch] = useState('');
  const portalContainer = useBrandPortalContainer();

  const filteredCampaigns = useMemo(() => {
    if (!search.trim()) return PLACEHOLDER_CAMPAIGNS;
    const q = search.toLowerCase();
    return PLACEHOLDER_CAMPAIGNS.filter((c) => c.name.toLowerCase().includes(q));
  }, [search]);

  const handleSelect = (item: CampaignItem | null) => {
    setSelected(item);
    setSearch('');
    setOpen(false);
  };

  const triggerLabel = selected ? selected.name : ALL_LABEL;

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      {/* ── Trigger ── */}
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          className={cn(
            'hidden lg:inline-flex items-center gap-1.5 rounded-[var(--r2)] px-3 py-1.5',
            'border border-[var(--border-1)] bg-[var(--surface-1)]/60',
            'text-xs text-[var(--text-2)] hover:text-[var(--text-1)] hover:border-[var(--border-2)]',
            'transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)]',
          )}
          aria-label="Sélectionner une campagne"
        >
          <Layers className="h-3.5 w-3.5 text-[var(--text-3)]" strokeWidth={1.5} />
          <span className="max-w-[140px] truncate">{triggerLabel}</span>
          <ChevronDown
            className={cn(
              'h-3 w-3 text-[var(--text-3)] motion-safe:transition-transform',
              open && 'rotate-180',
            )}
            strokeWidth={1.5}
          />
        </button>
      </PopoverPrimitive.Trigger>

      {/* ── Content ── */}
      <PopoverPrimitive.Portal container={portalContainer}>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={8}
          className={cn(
            'z-50 w-[360px] rounded-[var(--r3)]',
            'bg-[var(--surface-1)] border border-[var(--border-1)]',
            'shadow-[var(--shadow-brand-2)]',
            'outline-none',
            // Animation — Radix data-state attrs (motion-safe: respects prefers-reduced-motion)
            'motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0 motion-safe:data-[state=open]:zoom-in-95',
            'motion-safe:data-[state=closed]:animate-out motion-safe:data-[state=closed]:fade-out-0 motion-safe:data-[state=closed]:zoom-out-95',
          )}
        >
          {/* ── Header ── */}
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <h3 className="text-sm font-semibold text-[var(--text-1)] brand-tracking">
              Campagnes
            </h3>
            <PopoverPrimitive.Close asChild>
              <button
                type="button"
                className={cn(
                  'rounded-[var(--r2)] p-1',
                  'text-[var(--text-3)] hover:text-[var(--text-1)]',
                  'transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)]',
                )}
                aria-label="Fermer"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </PopoverPrimitive.Close>
          </div>

          {/* ── Search ── */}
          <div className="px-4 pb-2">
            <div className="relative">
              <span
                className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--text-3)]"
                aria-hidden="true"
              >
                <Search className="h-3.5 w-3.5" strokeWidth={1.5} />
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher…"
                className={cn(
                  'w-full rounded-[var(--r2)] py-2 pl-9 pr-3 text-xs',
                  'bg-[var(--surface-2)]/60 text-[var(--text-1)]',
                  'border border-[var(--border-1)]',
                  'placeholder:text-[var(--text-3)]',
                  'transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)]',
                  'focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--surface-1)]',
                )}
                aria-label="Rechercher une campagne"
              />
            </div>
          </div>

          {/* ── "All campaigns" option ── */}
          <div className="px-2">
            <button
              type="button"
              onClick={() => handleSelect(null)}
              className={cn(
                'flex w-full items-center gap-2 rounded-[var(--r2)] px-3 py-2',
                'text-xs font-medium transition-colors',
                !selected
                  ? 'bg-[var(--surface-2)]/60 text-[var(--text-1)]'
                  : 'text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)]/30',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:ring-inset',
              )}
            >
              <Layers className="h-3.5 w-3.5 text-[var(--text-3)]" strokeWidth={1.5} />
              {ALL_LABEL}
            </button>
          </div>

          {/* ── Campaign sections ── */}
          <div className="max-h-[280px] overflow-y-auto px-2 py-1 scrollbar-brand">
            {filteredCampaigns.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-xs text-[var(--text-3)] italic">Aucun résultat</p>
              </div>
            ) : (
              SECTIONS.map((section) => {
                const items = filteredCampaigns.filter((c) => c.status === section.key);
                if (items.length === 0) return null;

                return (
                  <div key={section.key} className="py-1">
                    {/* Section label */}
                    <p className="px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-[var(--text-3)]">
                      {section.label}
                    </p>

                    {/* Items */}
                    {items.map((item) => {
                      const isSelected = selected?.id === item.id;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelect(item)}
                          className={cn(
                            'flex w-full items-center justify-between gap-2 rounded-[var(--r2)] px-3 py-2',
                            'transition-colors',
                            isSelected
                              ? 'bg-[var(--surface-2)]/60'
                              : 'hover:bg-[var(--surface-2)]/30',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:ring-inset',
                          )}
                        >
                          {/* Left: name + budget */}
                          <div className="flex flex-col items-start gap-0.5 min-w-0">
                            <span
                              className={cn(
                                'text-xs font-medium truncate max-w-[200px]',
                                isSelected ? 'text-[var(--text-1)]' : 'text-[var(--text-2)]',
                              )}
                            >
                              {item.name}
                            </span>
                            <span className="text-[10px] text-[var(--text-3)] tabular-nums">
                              Budget : {item.budget}
                            </span>
                          </div>

                          {/* Right: status badge */}
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5',
                              'text-[10px] font-medium whitespace-nowrap',
                              statusClasses(item.status),
                            )}
                          >
                            {item.status === 'active' && (
                              <span
                                className="size-1 rounded-full bg-current"
                                aria-hidden="true"
                              />
                            )}
                            {statusLabel(item.status)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>

          {/* ── Footer ── */}
          <div className="border-t border-[var(--border-1)] px-4 py-2.5">
            <p className="text-[10px] text-[var(--text-3)]">
              Sélectionne une campagne pour filtrer le dashboard.
            </p>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
