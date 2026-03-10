'use client';

/**
 * DashboardPendingSubmissionsCard — "À valider" inbox for the brand dashboard.
 * Client component (Supabase Realtime + framer-motion micro pulse).
 *
 * Realtime filter: contestIdSetRef (Set<string>) for O(1) lookup.
 * Subscribes to INSERT on submissions table, filters by contest_id in callback
 * (submissions has no brand_id column).
 *
 * UI: GlassCard + brand Ink tokens. Inbox aesthetic.
 * Respects prefers-reduced-motion.
 */
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Inbox, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { GlassCard } from '@/components/brand-ui/GlassCard';
import { cn } from '@/lib/utils';

export function DashboardPendingSubmissionsCard({
  brandId,
  contestIds,
  initialPendingSubmissions,
}: {
  brandId: string;
  /** All contest IDs owned by this brand — used to filter realtime submissions */
  contestIds: string[];
  initialPendingSubmissions: number;
}) {
  const [pendingSubmissions, setPendingSubmissions] = useState(initialPendingSubmissions);
  const [pulseKey, setPulseKey] = useState(0);
  const [prefersReduced, setPrefersReduced] = useState(false);

  // Keep a stable Set reference for fast contest_id lookups in the callback
  const contestIdSetRef = useRef<Set<string>>(new Set(contestIds));
  useEffect(() => {
    contestIdSetRef.current = new Set(contestIds);
  }, [contestIds]);

  useEffect(() => {
    setPendingSubmissions(initialPendingSubmissions);
  }, [initialPendingSubmissions]);

  // Detect prefers-reduced-motion
  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReduced(mql.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  /* ── Realtime subscription — UNTOUCHED ── */
  useEffect(() => {
    const channel = supabase
      .channel(`brand-dashboard-pending-${brandId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'submissions',
        },
        (payload) => {
          const submission = payload.new as { status?: string; contest_id?: string };
          if (submission.status !== 'pending') return;
          if (!submission.contest_id || !contestIdSetRef.current.has(submission.contest_id)) return;
          setPendingSubmissions((current) => current + 1);
          setPulseKey((current) => current + 1);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [brandId]);

  return (
    <GlassCard className="space-y-4">
      {/* ── Header: "À valider" + live dot + ghost link ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Inbox className="h-4 w-4 text-[var(--text-3)]" strokeWidth={1.5} />
          <span className="text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">
            À valider
          </span>
          {pendingSubmissions > 0 && (
            <span
              className={cn(
                'rounded-full bg-[var(--brand-accent)] text-[var(--cta-fg)]',
                'text-[10px] font-bold px-1.5 py-0.5 min-w-[18px] text-center',
              )}
            >
              {pendingSubmissions}
            </span>
          )}
        </div>
        <Link
          href="/app/brand/moderation"
          className={cn(
            'inline-flex items-center gap-1 rounded-[var(--r2)] px-2 py-1',
            'text-[11px] font-medium text-[var(--text-3)]',
            'hover:text-[var(--text-1)] hover:bg-[var(--surface-2)]/40',
            'transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)]',
          )}
        >
          Modération
          <ArrowRight className="h-3 w-3" strokeWidth={1.5} />
        </Link>
      </div>

      {/* ── Content ── */}
      {pendingSubmissions > 0 ? (
        <>
          <div>
            <motion.div
              key={pulseKey}
              className="text-4xl font-semibold tracking-[-0.04em] brand-tabular text-[var(--text-1)]"
              animate={prefersReduced ? undefined : { scale: [1, 1.04, 1] }}
              transition={prefersReduced ? undefined : { duration: 0.3, ease: 'easeOut' }}
            >
              {pendingSubmissions}
            </motion.div>
            <p className="mt-1.5 text-sm text-[var(--text-2)]">
              vidéo{pendingSubmissions > 1 ? 's' : ''} en attente d&apos;approbation
            </p>
          </div>

          {/* ── Action link ── */}
          <Link
            href="/app/brand/moderation"
            className={cn(
              'flex items-center justify-between rounded-[var(--r2)] p-3',
              'bg-[var(--surface-2)] border border-[var(--border-1)]',
              'text-sm text-[var(--text-2)] hover:text-[var(--text-1)]',
              'hover:border-[var(--border-2)] transition-all',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)]',
              'group',
            )}
          >
            <span>Ouvrir la modération</span>
            <ArrowRight className="h-4 w-4 text-[var(--text-3)] group-hover:text-[var(--brand-accent)] transition-colors" />
          </Link>
        </>
      ) : (
        <div className="py-2 space-y-2">
          <p className="text-sm text-[var(--text-2)]">Aucune vidéo en attente</p>
          <div className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={cn(
                'size-1.5 rounded-full bg-[var(--brand-accent)] shadow-[0_0_6px_var(--brand-accent)]',
                !prefersReduced && 'animate-pulse',
              )}
            />
            <p className="text-xs text-[var(--text-3)]">
              En écoute Live — les nouvelles soumissions apparaîtront ici.
            </p>
          </div>
        </div>
      )}
    </GlassCard>
  );
}
