'use client';

/**
 * BrandRailNav — Premium rail navigation with flyout label panel.
 *
 * Architecture:
 * - Rail is FIXED at w-16 (64px) — never changes width.
 * - On hover/focus: a floating flyout panel slides in from the right
 *   edge of the rail (spring animation) displaying labels aligned
 *   with the rail icons.
 * - Tooltips shown only when flyout is hidden (keyboard-only fallback).
 *
 * Active state: Race Light edge (2px accent bar) + micro glow (inset shadow).
 * Respects prefers-reduced-motion (instant transitions).
 * Hidden on mobile (lg:block). Mobile nav handled by BrandTopBar drawer.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Layers,
  Inbox,
  Users,
  MessageSquare,
  CreditCard,
  Settings,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/* ── Nav item type ── */
type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
};

/* ── Route definitions (verified against src/app/app/brand/) ── */
const mainItems: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', href: '/app/brand/dashboard', icon: LayoutDashboard },
  { key: 'campaigns', label: 'Campagnes', href: '/app/brand/contests', icon: Layers },
  { key: 'moderation', label: 'Modération', href: '/app/brand/moderation', icon: Inbox },
  { key: 'creators', label: 'Créateurs', href: '/app/brand/creators', icon: Users },
  { key: 'messages', label: 'Messages', href: '/app/brand/messages', icon: MessageSquare },
];

const bottomItems: NavItem[] = [
  { key: 'billing', label: 'Facturation', href: '/app/brand/billing', icon: CreditCard },
  { key: 'settings', label: 'Paramètres', href: '/app/brand/settings', icon: Settings },
];

/* ── Spring config (vif & organique per BRAND_UI_SPEC) ── */
const flyoutSpring = { stiffness: 400, damping: 30 };

export function BrandRailNav() {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);
  const [prefersReduced, setPrefersReduced] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReduced(mql.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const expand = useCallback(() => setExpanded(true), []);
  const collapse = useCallback(() => setExpanded(false), []);

  const handleBlurCapture = useCallback(
    (e: React.FocusEvent) => {
      // Only collapse if focus leaves the nav wrapper entirely
      if (!wrapperRef.current?.contains(e.relatedTarget as Node)) {
        collapse();
      }
    },
    [collapse],
  );

  const isActive = (item: NavItem) => {
    if (item.key === 'campaigns') return pathname.startsWith('/app/brand/contests');
    if (item.key === 'moderation') {
      return pathname.startsWith('/app/brand/moderation') || pathname.includes('/submissions');
    }
    return pathname.startsWith(item.href);
  };

  /* ── Rail icon item (canonical link, keyboard-accessible) ── */
  const renderRailItem = (item: NavItem) => {
    const active = isActive(item);
    const Icon = item.icon;

    const link = (
      <Link
        href={item.href}
        aria-current={active ? 'page' : undefined}
        aria-label={item.label}
        className={cn(
          'relative flex items-center justify-center h-10 rounded-[var(--r2)]',
          'transition-colors duration-[var(--duration-fast)]',
          active
            ? 'bg-[var(--surface-2)]/60 text-[var(--text-1)] shadow-[inset_2px_0_12px_-4px_var(--accent-soft)]'
            : 'text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)]/30',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:ring-inset',
        )}
      >
        {/* Race Light edge (active only) */}
        {active && (
          <span
            className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-[var(--brand-accent)] shadow-[0_0_8px_var(--brand-accent)]"
            aria-hidden="true"
          />
        )}
        <Icon className="h-[18px] w-[18px]" strokeWidth={1.5} />
      </Link>
    );

    // Tooltip only when flyout is hidden
    if (!expanded) {
      return (
        <Tooltip key={item.key} delayDuration={200}>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent
            side="right"
            sideOffset={16}
            className="bg-[var(--surface-2)] text-[var(--text-1)] border-[var(--border-1)] text-xs font-medium"
          >
            {item.label}
          </TooltipContent>
        </Tooltip>
      );
    }

    return <div key={item.key}>{link}</div>;
  };

  /* ── Flyout label item (visual duplicate, mouse-clickable, not keyboard-focusable) ── */
  const renderFlyoutItem = (item: NavItem) => {
    const active = isActive(item);

    return (
      <Link
        key={item.key}
        href={item.href}
        tabIndex={-1}
        aria-hidden="true"
        className={cn(
          'flex items-center h-10 px-3 rounded-[var(--r2)]',
          'text-sm font-medium whitespace-nowrap',
          'transition-colors duration-[var(--duration-fast)]',
          active
            ? 'text-[var(--text-1)]'
            : 'text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)]/30',
        )}
      >
        {item.label}
      </Link>
    );
  };

  const flyoutTransition = prefersReduced
    ? { duration: 0 }
    : { type: 'spring' as const, ...flyoutSpring };

  return (
    <div
      ref={wrapperRef}
      className={cn(
        'fixed left-0 top-0 bottom-0 z-30 hidden lg:block',
        // Dynamic width controls pointer hit area only (wrapper is invisible)
        expanded ? 'w-[220px]' : 'w-16',
      )}
      onPointerEnter={expand}
      onPointerLeave={collapse}
      onFocusCapture={expand}
      onBlurCapture={handleBlurCapture}
    >
      {/* ══════════════════════════════════════════════
          RAIL BACKGROUND — always 64px, never moves
          ══════════════════════════════════════════════ */}
      <div
        className="absolute left-0 top-0 bottom-0 w-16 bg-[var(--surface-1)]/95 backdrop-blur-xl border-r border-[var(--border-1)]"
        aria-hidden="true"
      />

      {/* ══════════════════════════════════════════════
          RAIL NAV — icons only, in 64px zone
          ══════════════════════════════════════════════ */}
      <nav
        className="absolute left-0 top-0 bottom-0 w-16 flex flex-col py-4 z-10"
        aria-label="Navigation principale"
      >
        {/* Logo */}
        <div className="flex items-center justify-center h-10 mb-6 shrink-0">
          <span className="text-sm font-bold text-[var(--brand-accent)]" aria-label="ClipRace">
            C
          </span>
          <span
            aria-hidden="true"
            className="ml-0.5 size-1.5 rounded-full bg-[var(--brand-accent)] shadow-[0_0_6px_var(--brand-accent)]"
          />
        </div>

        {/* Main items */}
        <div className="flex-1 flex flex-col gap-1 px-2">
          {mainItems.map(renderRailItem)}
        </div>

        {/* Separator */}
        <div className="my-2 mx-3 shrink-0">
          <div className="h-px bg-[var(--border-1)]" />
        </div>

        {/* Bottom items */}
        <div className="flex flex-col gap-1 px-2 shrink-0">
          {bottomItems.map(renderRailItem)}
        </div>
      </nav>

      {/* ══════════════════════════════════════════════
          FLYOUT LABEL PANEL — slides in on hover/focus
          Alignment: top-2/bottom-2 + py-2 = same content
          origin as rail (py-4), so labels align with icons.
          ══════════════════════════════════════════════ */}
      <AnimatePresence>
        {expanded && (
          <motion.aside
            className={cn(
              'absolute top-2 bottom-2 left-[68px] w-[152px] flex flex-col py-2 z-10',
              'bg-[var(--surface-1)] border border-[var(--border-1)]',
              'rounded-[var(--r3)] shadow-[var(--shadow-brand-2)]',
            )}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={flyoutTransition}
            aria-hidden="true"
          >
            {/* Logo label */}
            <div className="flex items-center h-10 mb-6 px-4 shrink-0">
              <span className="text-sm font-semibold text-[var(--text-1)] brand-tracking whitespace-nowrap">
                ClipRace
              </span>
            </div>

            {/* Main labels */}
            <div className="flex-1 flex flex-col gap-1 px-2">
              {mainItems.map(renderFlyoutItem)}
            </div>

            {/* Separator */}
            <div className="my-2 mx-3 shrink-0">
              <div className="h-px bg-[var(--border-1)]" />
            </div>

            {/* Bottom labels */}
            <div className="flex flex-col gap-1 px-2 shrink-0">
              {bottomItems.map(renderFlyoutItem)}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
