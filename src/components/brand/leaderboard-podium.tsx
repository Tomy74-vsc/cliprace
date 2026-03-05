'use client';

/**
 * LeaderboardPodium — Podium animé pour le leaderboard brand.
 * Client component (Framer Motion stagger + Race Light glow sur #1).
 *
 * Layout podium:
 *   [  #2  ] [    #1    ] [  #3  ]
 * Le #1 est plus grand (h-56 vs h-44/h-36) et a le Race Light glow.
 */

import { motion } from 'framer-motion';
import { Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/formatters';
import type { LeaderboardEntry } from '@/lib/queries/contest-leaderboard';

interface PodiumEntry extends LeaderboardEntry {
  estimated_payout_cents: number;
}

interface LeaderboardPodiumProps {
  entries: PodiumEntry[]; // 1 à 3 entrées max
  currency: string;
  mode: 'views' | 'score';
}

// Ordre d'affichage podium: [#2, #1, #3]
function getPodiumOrder(entries: PodiumEntry[]): Array<PodiumEntry | null> {
  const first = entries.find((e) => e.rank === 1) || entries[0] || null;
  const second = entries.find((e) => e.rank === 2) || entries[1] || null;
  const third = entries.find((e) => e.rank === 3) || entries[2] || null;
  return [second, first, third];
}

const MEDALS = ['🥈', '🥇', '🥉'] as const; // index 0=left(#2), 1=center(#1), 2=right(#3)
const HEIGHTS = ['h-44', 'h-56', 'h-36'] as const; // #2, #1, #3
const DELAYS = [0.15, 0, 0.3] as const;

export function LeaderboardPodium({ entries, currency, mode }: LeaderboardPodiumProps) {
  const podiumOrder = getPodiumOrder(entries);

  return (
    <div className="grid grid-cols-3 gap-3 sm:gap-4 items-end">
      {podiumOrder.map((entry, colIdx) => {
        const heightClass = HEIGHTS[colIdx];

        if (!entry) {
          return (
            <div
              key={`empty-${colIdx}`}
              className={cn(
                heightClass,
                'rounded-[var(--r3)] border border-dashed border-[var(--border-1)]',
                'flex items-center justify-center',
              )}
            >
              <span className="text-xs text-[var(--text-3)]">—</span>
            </div>
          );
        }

        const isCenter = colIdx === 1;
        const isFirst = entry.rank === 1;

        return (
          <motion.div
            key={entry.creator_id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: DELAYS[colIdx],
              type: 'spring',
              stiffness: 300,
              damping: 28,
            }}
            className={cn(
              heightClass,
              'relative rounded-[var(--r3)] border overflow-hidden',
              'flex flex-col justify-between p-4 sm:p-5',
              isFirst
                ? 'border-[var(--accent)]/40 bg-[var(--surface-1)]'
                : 'border-[var(--border-1)] bg-[var(--surface-1)]/80',
            )}
          >
            {/* Race Light glow — seulement sur #1 */}
            {isFirst && (
              <>
                <div
                  className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2
                    h-24 w-32 rounded-full bg-[var(--accent)]/20 blur-2xl"
                  aria-hidden="true"
                />
                <div className="beam-border absolute inset-0 rounded-[var(--r3)]" aria-hidden="true" />
              </>
            )}

            {/* TOP: Médaille + Rang */}
            <div className="flex items-center justify-between relative z-10">
              <span className="text-xl" role="img" aria-label={`Médaille rang ${entry.rank}`}>
                {MEDALS[colIdx]}
              </span>
              <span
                className={cn(
                  'text-xs font-semibold tabular-nums rounded-[var(--r-pill)] px-2 py-0.5',
                  isFirst
                    ? 'bg-[var(--accent)]/15 text-[var(--accent)]'
                    : 'bg-[var(--surface-2)] text-[var(--text-3)]',
                )}
              >
                #{entry.rank}
              </span>
            </div>

            {/* MIDDLE: Nom + métrique principale */}
            <div className="relative z-10 flex-1 flex items-center">
              <div className="min-w-0">
                <p
                  className={cn(
                    'font-semibold truncate brand-tracking',
                    isFirst ? 'text-base text-[var(--text-1)]' : 'text-sm text-[var(--text-1)]',
                  )}
                >
                  {entry.creator_name}
                </p>
                <p
                  className={cn(
                    'tabular-nums mt-0.5',
                    isFirst ? 'text-sm text-[var(--text-2)]' : 'text-xs text-[var(--text-3)]',
                  )}
                >
                  {mode === 'views'
                    ? `${entry.total_views.toLocaleString('fr-FR')} vues`
                    : `${entry.total_weighted_views.toLocaleString('fr-FR', {
                        maximumFractionDigits: 0,
                      })} pts`}
                </p>
              </div>
            </div>

            {/* BOTTOM: Gain estimé / état */}
            <div className="relative z-10">
              {entry.estimated_payout_cents > 0 ? (
                <div
                  className={cn(
                    'rounded-[var(--r2)] px-3 py-1.5 text-center',
                    isFirst
                      ? 'bg-[var(--accent)]/10 border border-[var(--accent)]/20'
                      : 'bg-[var(--surface-2)]/60 border border-[var(--border-1)]',
                  )}
                >
                  <p className="text-[11px] text-[var(--text-3)] uppercase tracking-wide">
                    Gain estimé
                  </p>
                  <p
                    className={cn(
                      'font-semibold tabular-nums text-sm mt-0.5',
                      isFirst ? 'text-[var(--accent)]' : 'text-[var(--text-1)]',
                    )}
                  >
                    {formatCurrency(entry.estimated_payout_cents, currency)}
                  </p>
                </div>
              ) : (
                <div
                  className="rounded-[var(--r2)] px-3 py-1.5 text-center
                  bg-[var(--surface-2)]/40 border border-[var(--border-1)]"
                >
                  <p className="text-[11px] text-[var(--text-3)]">
                    {isCenter ? 'En tête du classement' : 'Top 3'}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

