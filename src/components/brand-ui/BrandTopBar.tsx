'use client';

/**
 * BrandTopBar — Glass "Command Center" top bar for brand pages.
 *
 * Desktop: Brand Identity Block (avatar + name) | Live pill | Campaign Selector
 *          | CmdK trigger | CTA "Créer"
 * Mobile:  hamburger + "ClipRace" + CTA. Hamburger opens BrandDrawer with full nav.
 *
 * A11y: aria-labels, focus rings Race Light, keyboard nav.
 */
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, Plus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BrandDrawer } from './BrandDrawer';
import { CampaignSelector } from './CampaignSelector';

/* ── Mobile nav items (verified against src/app/app/brand/) ── */
const mobileNavItems = [
  { label: 'Dashboard', href: '/app/brand/dashboard' },
  { label: 'Campagnes', href: '/app/brand/contests' },
  { label: 'Modération', href: '/app/brand/moderation' },
  { label: 'Créateurs', href: '/app/brand/creators' },
  { label: 'Messages', href: '/app/brand/messages' },
  { label: 'Facturation', href: '/app/brand/billing' },
  { label: 'Paramètres', href: '/app/brand/settings' },
];

export interface BrandTopBarProps {
  /** Company name from profile_brands — shown on desktop */
  companyName?: string | null;
  /** Brand logo URL (optional). Falls back to initials circle. */
  brandLogoUrl?: string | null;
}

/* ── Brand Identity Block (inline — avatar + name) ── */
function BrandIdentityBlock({
  companyName,
  brandLogoUrl,
}: {
  companyName?: string | null;
  brandLogoUrl?: string | null;
}) {
  const displayName = companyName || 'Marque';
  const initials = displayName
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="hidden lg:flex items-center gap-2.5">
      {/* Avatar / Logo */}
      <div
        className={cn(
          'size-8 rounded-full shrink-0 overflow-hidden',
          'bg-[var(--surface-2)] border border-[var(--border-1)]',
          'flex items-center justify-center',
        )}
      >
        {brandLogoUrl ? (
          <img
            src={brandLogoUrl}
            alt={`${displayName} logo`}
            className="size-full object-cover"
          />
        ) : (
          <span className="text-[11px] font-semibold text-[var(--text-2)] select-none">
            {initials}
          </span>
        )}
      </div>

      {/* Name + sub-label */}
      <div className="flex flex-col min-w-0">
        <span className="text-sm font-medium text-[var(--text-1)] brand-tracking truncate max-w-[160px] leading-tight">
          {displayName}
        </span>
        <span className="text-[10px] text-[var(--text-3)] leading-tight">
          Marque
        </span>
      </div>
    </div>
  );
}

export function BrandTopBar({ companyName, brandLogoUrl }: BrandTopBarProps) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <>
      <header
        className={cn(
          'sticky top-0 z-20 h-14 shrink-0',
          'bg-[var(--bg-void)]/80 backdrop-blur-xl',
          'border-b border-[var(--border-1)]',
          'flex items-center justify-between px-4 lg:px-6',
        )}
      >
        {/* ── Left section ── */}
        <div className="flex items-center gap-3">
          {/* Hamburger (mobile only) */}
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className={cn(
              'lg:hidden rounded-[var(--r2)] p-2',
              'text-[var(--text-3)] hover:text-[var(--text-1)]',
              'transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)]',
            )}
            aria-label="Ouvrir le menu"
          >
            <Menu className="h-5 w-5" strokeWidth={1.5} />
          </button>

          {/* Logo (mobile) */}
          <span className="lg:hidden text-sm font-semibold text-[var(--text-1)] brand-tracking">
            ClipRace
          </span>

          {/* ── Brand Identity Block (desktop) ── */}
          <BrandIdentityBlock
            companyName={companyName}
            brandLogoUrl={brandLogoUrl}
          />

          {/* ── Separator (desktop) ── */}
          <div className="hidden lg:block w-px h-5 bg-[var(--border-1)]" aria-hidden="true" />

          {/* ── Live indicator (pill) ── */}
          <div
            className={cn(
              'hidden sm:inline-flex items-center gap-1.5',
              'rounded-[var(--r-pill)] px-2.5 py-1',
              'bg-[var(--surface-1)]/60 border border-[var(--border-1)]',
            )}
          >
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full bg-[var(--brand-accent)] animate-pulse shadow-[0_0_6px_var(--brand-accent)]"
            />
            <span className="text-[11px] font-medium text-[var(--text-3)] uppercase tracking-wide">
              Live
            </span>
          </div>

          {/* ── Separator (desktop) ── */}
          <div className="hidden lg:block w-px h-5 bg-[var(--border-1)]" aria-hidden="true" />

          {/* ── Campaign Selector (desktop, Radix Popover) ── */}
          <CampaignSelector />
        </div>

        {/* ── Right section ── */}
        <div className="flex items-center gap-2">
          {/* CmdK trigger */}
          <button
            type="button"
            className={cn(
              'hidden sm:inline-flex items-center gap-1.5 rounded-[var(--r2)] px-3 py-1.5',
              'border border-[var(--border-1)] bg-[var(--surface-1)]/60',
              'text-xs text-[var(--text-3)] hover:text-[var(--text-2)] hover:border-[var(--border-2)]',
              'transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)]',
            )}
            aria-label="Recherche rapide"
          >
            <Search className="h-3.5 w-3.5" strokeWidth={1.5} />
            <kbd className="font-mono text-[10px] text-[var(--text-3)]">⌘K</kbd>
          </button>

          {/* Primary CTA (Uber-style) */}
          <Link
            href="/app/brand/contests/new"
            className={cn(
              'inline-flex items-center gap-1.5 rounded-[var(--r2)] px-4 py-2',
              'bg-[var(--cta-bg)] text-[var(--cta-fg)]',
              'text-xs font-semibold',
              'hover:bg-white/90 transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50',
              'focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-void)]',
            )}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            <span className="hidden sm:inline">Créer</span>
          </Link>
        </div>
      </header>

      {/* ── Mobile Navigation Drawer (vaul) ── */}
      <BrandDrawer
        open={mobileNavOpen}
        onOpenChange={setMobileNavOpen}
        title="Navigation"
      >
        <nav className="flex flex-col gap-1" aria-label="Navigation principale">
          {mobileNavItems.map((item) => {
            const active =
              item.href === '/app/brand/contests'
                ? pathname.startsWith('/app/brand/contests')
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileNavOpen(false)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center rounded-[var(--r2)] px-4 py-3',
                  'text-sm font-medium transition-colors',
                  active
                    ? 'bg-[var(--surface-2)]/60 text-[var(--text-1)]'
                    : 'text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)]/30',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:ring-inset',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </BrandDrawer>
    </>
  );
}
