'use client';

/**
 * RiveLoader — Rive animation loader with graceful fallback.
 * Client component. Lazy-loads Rive runtime.
 *
 * Features:
 * - Loads a Rive animation from a URL
 * - Fallback: lucide Loader2 spinner
 * - Respects prefers-reduced-motion (shows static fallback)
 * - Error boundary: catches WASM/render errors → shows fallback
 * - Size controlled via className (e.g. w-16 h-16) — default 80×80 (w-20 h-20)
 */
import { Component, useEffect, useState, useRef, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface RiveLoaderProps {
  /** URL to a .riv file */
  src?: string;
  /** Additional className — use w-* h-* to control size */
  className?: string;
  /** Label for accessibility */
  label?: string;
}

const CONTAINER_BASE = 'flex items-center justify-center w-20 h-20';

/* ── Fallback spinner ── */
function FallbackSpinner({
  className,
  label = 'Chargement',
  animate = true,
}: {
  className?: string;
  label?: string;
  animate?: boolean;
}) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn(CONTAINER_BASE, className)}
    >
      <Loader2
        className={cn(
          'h-2/5 w-2/5 text-[var(--brand-accent)]',
          animate && 'animate-spin',
        )}
        strokeWidth={1.5}
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}

/* ── Error boundary: catches Rive WASM / render errors ── */
interface ErrorBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}
interface ErrorBoundaryState {
  hasError: boolean;
}
class RiveErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

/* ── Main component ── */
export function RiveLoader({
  src,
  className,
  label = 'Chargement',
}: RiveLoaderProps) {
  const [prefersReduced, setPrefersReduced] = useState(false);
  const [riveError, setRiveError] = useState(false);
  const [RiveComponent, setRiveComponent] = useState<React.ComponentType | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Detect reduced motion
  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReduced(mql.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // Lazy-load Rive — only when src is provided
  useEffect(() => {
    if (!src || prefersReduced) return;

    let cancelled = false;

    async function loadRive() {
      try {
        // First verify the .riv file is reachable (HEAD request)
        const probe = await fetch(src!, { method: 'HEAD', mode: 'cors' });
        if (!probe.ok || cancelled) {
          if (!cancelled) setRiveError(true);
          return;
        }

        const { useRive } = await import('@rive-app/react-canvas');
        if (cancelled) return;

        function RiveWrapper() {
          const { RiveComponent: RC } = useRive({
            src: src!,
            autoplay: true,
          });
          return RC ? <RC /> : null;
        }

        setRiveComponent(() => RiveWrapper);
      } catch {
        if (!cancelled) setRiveError(true);
      }
    }

    loadRive();
    return () => {
      cancelled = true;
    };
  }, [src, prefersReduced]);

  // Reduced motion or no src: static fallback
  if (prefersReduced || !src) {
    return (
      <FallbackSpinner
        className={className}
        label={label}
        animate={!prefersReduced}
      />
    );
  }

  // Error or still loading: spinner fallback
  if (riveError || !RiveComponent) {
    return (
      <FallbackSpinner
        className={className}
        label={label}
      />
    );
  }

  return (
    <RiveErrorBoundary
      fallback={<FallbackSpinner className={className} label={label} />}
    >
      <div
        ref={containerRef}
        role="status"
        aria-label={label}
        className={cn(CONTAINER_BASE, className)}
      >
        <RiveComponent />
        <span className="sr-only">{label}</span>
      </div>
    </RiveErrorBoundary>
  );
}
