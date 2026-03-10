/**
 * BrandShell — Layout wrapper for brand-facing pages.
 * Server component. No framer-motion import.
 *
 * Applies .brand-scope on the root div, which:
 * - Activates all Brand Ink CSS tokens (--bg-void, --text-1, etc.)
 * - Forces bg #050505 + white text + dark color-scheme
 * - Enables brand utilities (track-pattern, beam-border, etc.)
 *
 * Also renders a portal root (#brand-portal-root) INSIDE .brand-scope
 * so that Radix/Vaul portals (Dialog, Drawer) inherit the Ink tokens.
 *
 * Modes:
 * - Default: wraps children in <main> container (max-w-7xl, px-6, padding).
 * - Bare: renders children directly — for complex layouts that manage
 *   their own structure (e.g. the app brand layout with fixed overlays).
 *
 * Pages NOT wrapped in BrandShell (Admin, Public) are never affected.
 */
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { BRAND_PORTAL_ID } from './use-brand-portal';

export interface BrandShellProps {
  children: ReactNode;
  /** Optional topbar content (logo, nav, CmdK trigger) */
  topbar?: ReactNode;
  /** Additional className on outer container */
  className?: string;
  /**
   * Skip <main> wrapper — children render directly inside brand-scope.
   * Use for layout components that manage their own structure.
   */
  bare?: boolean;
}

export function BrandShell({ children, topbar, className, bare }: BrandShellProps) {
  return (
    <div
      className={cn(
        'brand-scope min-h-screen',
        className,
      )}
    >
      {/* ── Glass topbar ── */}
      {topbar && (
        <header
          className={cn(
            'fixed top-0 inset-x-0 z-40 h-14',
            'bg-[var(--bg-void)]/80 backdrop-blur-xl',
            'border-b border-[var(--border-1)]',
          )}
        >
          <div className="mx-auto max-w-7xl px-6 h-full flex items-center justify-between">
            {topbar}
          </div>
        </header>
      )}

      {bare ? (
        children
      ) : (
        <main
          className={cn(
            'relative mx-auto max-w-7xl px-6',
            topbar ? 'pt-20' : 'pt-8',
            'pb-16',
          )}
        >
          {children}
        </main>
      )}

      {/* ── Portal root for Radix/Vaul (inside .brand-scope so tokens resolve) ── */}
      <div id={BRAND_PORTAL_ID} />
    </div>
  );
}
