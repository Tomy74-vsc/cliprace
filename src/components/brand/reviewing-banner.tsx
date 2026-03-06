'use client';

/**
 * ReviewingBanner — Bandeau d'urgence affiché quand status = reviewing.
 * Countdown live vers ends_at. Disparaît si expiré.
 * Client island car countdown setInterval.
 */
import Link from 'next/link';
import { AlertTriangle, Clock, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCountdown } from '@/hooks/use-countdown';

interface ReviewingBannerProps {
  contestId: string;
  endsAt: string | null;
  pendingCount: number;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function ReviewingBanner({
  contestId,
  endsAt,
  pendingCount,
}: ReviewingBannerProps) {
  const countdown = useCountdown(endsAt);

  // Masquer si expiré (cron va bientôt passer)
  if (countdown?.isExpired) return null;

  const hasTime = countdown !== null && endsAt !== null;
  const isUrgent = hasTime && (
    countdown.days === 0 && countdown.hours < 6
  );

  return (
    <div
      role="alert"
      className={cn(
        'rounded-[var(--r3)] border p-4',
        'flex flex-col sm:flex-row sm:items-center gap-3',
        isUrgent
          ? 'border-[var(--brand-danger)]/30 bg-[var(--brand-danger)]/8'
          : 'border-[var(--brand-warning)]/30 bg-[var(--brand-warning)]/8',
      )}
    >
      {/* Icon */}
      <div className={cn(
        'shrink-0 h-9 w-9 rounded-full flex items-center justify-center',
        isUrgent
          ? 'bg-[var(--brand-danger)]/15'
          : 'bg-[var(--brand-warning)]/15',
      )}>
        <AlertTriangle className={cn(
          'h-4.5 w-4.5',
          isUrgent
            ? 'text-[var(--brand-danger)]'
            : 'text-[var(--brand-warning)]',
        )} strokeWidth={2} />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-sm font-semibold',
          isUrgent
            ? 'text-[var(--brand-danger)]'
            : 'text-[var(--brand-warning)]',
        )}>
          Phase de révision — validation automatique dans{' '}
          {hasTime ? (
            <span
              aria-live="polite"
              aria-atomic="true"
              aria-label={`${countdown.hours} heures ${countdown.minutes} minutes`}
              className="tabular-nums"
            >
              {countdown.days > 0 && `${countdown.days}j `}
              {pad(countdown.hours)}h {pad(countdown.minutes)}min
            </span>
          ) : (
            'moins de 48h'
          )}
        </p>
        <p className="text-xs text-[var(--text-3)] mt-0.5">
          {pendingCount > 0
            ? `${pendingCount} soumission${pendingCount > 1 ? 's' : ''} en attente de modération.`
            : 'Toutes les soumissions ont été traitées.'}{' '}
          Sans action de ta part, elles seront validées automatiquement.
        </p>
      </div>

      {/* CTA */}
      {pendingCount > 0 && (
        <Link
          href={`/app/brand/contests/${contestId}/submissions?status=pending`}
          className={cn(
            'shrink-0 inline-flex items-center gap-1.5',
            'rounded-[var(--r2)] px-4 py-2 text-xs font-medium',
            'transition-colors whitespace-nowrap',
            'focus-visible:outline-none focus-visible:ring-2',
            'focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-void)]',
            isUrgent
              ? 'bg-[var(--brand-danger)] text-white hover:bg-red-600 focus-visible:ring-[var(--brand-danger)]'
              : 'bg-[var(--brand-warning)] text-[var(--bg-void)] hover:opacity-90 focus-visible:ring-[var(--brand-warning)]',
          )}
        >
          <Clock className="h-3.5 w-3.5" />
          Modérer maintenant
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}
