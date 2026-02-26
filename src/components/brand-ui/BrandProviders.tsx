'use client';

/**
 * BrandProviders — Shared context wrapper for all brand-facing pages.
 * Client component. Wraps children with:
 *
 * 1. Sonner <Toaster /> (dark Ink theme, bottom-right)
 * 2. Radix <TooltipProvider /> (global delay config)
 * 3. Lenis <ReactLenis /> (smooth scroll, optional, disabled for reduced-motion)
 *
 * Usage: wrap brand layout children with <BrandProviders>{children}</BrandProviders>
 */
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';

export interface BrandProvidersProps {
  children: ReactNode;
  /** Enable Lenis smooth scroll (default: false) */
  smoothScroll?: boolean;
}

export function BrandProviders({
  children,
  smoothScroll = false,
}: BrandProvidersProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Lenis types are complex; we only use root + children
  const [LenisProvider, setLenisProvider] = useState<React.ComponentType<any> | null>(null);
  const [prefersReduced, setPrefersReduced] = useState(false);

  // Detect reduced motion
  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReduced(mql.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // Lazy-load Lenis only when enabled and not reduced-motion
  useEffect(() => {
    if (!smoothScroll || prefersReduced) return;

    let cancelled = false;

    async function loadLenis() {
      try {
        const mod = await import('lenis/react');
        if (!cancelled && mod.ReactLenis) {
          setLenisProvider(() => mod.ReactLenis);
        }
      } catch {
        // Lenis unavailable — silent fallback (no smooth scroll)
      }
    }

    loadLenis();
    return () => {
      cancelled = true;
    };
  }, [smoothScroll, prefersReduced]);

  const content = (
    <TooltipProvider delayDuration={300} skipDelayDuration={150}>
      {children}

      <Toaster
        position="bottom-right"
        theme="dark"
        toastOptions={{
          style: {
            background: 'var(--surface-1)',
            border: '1px solid var(--border-1)',
            color: 'var(--text-1)',
          },
        }}
      />
    </TooltipProvider>
  );

  // Wrap in Lenis if loaded
  if (LenisProvider && smoothScroll && !prefersReduced) {
    return <LenisProvider root>{content}</LenisProvider>;
  }

  return content;
}
