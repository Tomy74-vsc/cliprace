'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '@/components/brand-ui';
import { useCountdown } from '@/hooks/use-countdown';
import {
  Clock, ExternalLink, Copy, Check, Share2, Twitter, Linkedin,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/formatters';

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

interface PendingLiveClientProps {
  contestId: string;
  contestTitle: string;
  liveAt: string | null;
  prizePoolCents: number;
  currency: string;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function CountdownBlock({
  parts,
}: {
  parts: { days: number; hours: number; minutes: number; seconds: number };
}) {
  const units = [
    { value: parts.days,    label: 'Jours' },
    { value: parts.hours,   label: 'Heures' },
    { value: parts.minutes, label: 'Min' },
    { value: parts.seconds, label: 'Sec' },
  ];
  return (
    <div
      className="flex flex-wrap justify-center gap-3"
      aria-live="polite"
      aria-atomic="true"
      aria-label={`${parts.hours}h ${parts.minutes}min ${parts.seconds}sec`}
    >
      {units.map(({ value, label }, idx) => (
        <div key={label} className="flex items-center gap-3">
          {idx > 0 && (
            <span className="text-xl font-thin text-[var(--text-3)]
              motion-safe:animate-pulse" aria-hidden="true">
              :
            </span>
          )}
          <div className="flex flex-col items-center">
            <div className="rounded-[var(--r3)] bg-[var(--surface-2)]
              border border-[var(--border-1)] px-4 py-3 min-w-[64px] text-center">
              <span className="text-3xl font-semibold tabular-nums
                text-[var(--text-1)]">
                {pad(value)}
              </span>
            </div>
            <span className="mt-1.5 text-[11px] uppercase tracking-wide
              text-[var(--text-3)]">
              {label}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function CopyButton({
  text,
  label,
  labelCopied = 'Copié !',
  className,
}: {
  text: string;
  label: string;
  labelCopied?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* noop */ }
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-[var(--r2)]',
        'px-3 py-1.5 text-xs font-medium transition-all',
        'focus-visible:outline-none focus-visible:ring-2',
        'focus-visible:ring-[var(--accent)]',
        copied
          ? 'bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/20'
          : 'border border-[var(--border-1)] text-[var(--text-2)] hover:border-[var(--border-2)] hover:text-[var(--text-1)]',
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.span key="check"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="flex items-center gap-1.5"
          >
            <Check className="h-3.5 w-3.5" />
            {labelCopied}
          </motion.span>
        ) : (
          <motion.span key="copy"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="flex items-center gap-1.5"
          >
            <Copy className="h-3.5 w-3.5" />
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

export function PendingLiveClient({
  contestId,
  contestTitle,
  liveAt,
  prizePoolCents,
  currency,
}: PendingLiveClientProps) {
  const countdown = useCountdown(liveAt);
  const showCountdown = liveAt != null && countdown != null && !countdown.isExpired;
  const shareUrl = appUrl
    ? `${appUrl.replace(/\/$/, '')}/contests/${contestId}`
    : '';

  const caption = `🎬 On lance un concours UGC "${contestTitle}" — ${formatCurrency(prizePoolCents, currency)} à gagner pour les meilleurs créateurs.\n\nParticipez ici 👉 ${shareUrl}\n\n#UGC #ClipRace #CreatorContest`;

  const shareUrls = shareUrl
    ? {
        twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(
          `🎬 Concours UGC "${contestTitle}" — ${formatCurrency(prizePoolCents, currency)} à gagner !\n\n`,
        )}&url=${encodeURIComponent(shareUrl)}`,
        linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
      }
    : null;

  return (
    <div className="space-y-4">

      {/* ── COUNTDOWN HERO ── */}
      <GlassCard className="relative overflow-hidden p-6 sm:p-8 text-center">
        {/* Ambient glow */}
        <div
          className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2
            h-32 w-48 rounded-full bg-[var(--accent)]/15 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative z-10 space-y-5">
          <div className="flex items-center justify-center gap-1.5 text-xs
            font-medium text-[var(--text-3)] uppercase tracking-wide">
            <Clock className="h-3.5 w-3.5 text-[var(--brand-warning)]" />
            <span className="text-[var(--brand-warning)]">Bientôt en ligne</span>
          </div>

          {!liveAt ? (
            <p className="text-sm text-[var(--text-2)]">Lancement imminent</p>
          ) : showCountdown ? (
            <>
              <CountdownBlock parts={countdown} />
              <p className="text-xs text-[var(--text-3)]">
                Profite de ce délai pour préparer ta communication !
              </p>
            </>
          ) : (
            <div className="space-y-2">
              <div className="text-4xl">🚀</div>
              <p className="text-base font-semibold text-[var(--accent)]">
                Ton concours est actif !
              </p>
              <p className="text-xs text-[var(--text-3)]">
                Rafraîchis la page pour voir les participations.
              </p>
            </div>
          )}
        </div>
      </GlassCard>

      {/* ── LIEN DE PARTAGE ── */}
      {shareUrl && (
        <GlassCard className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-[var(--accent)]" />
            <h2 className="text-sm font-semibold text-[var(--text-1)]">
              Lien du concours
            </h2>
          </div>

          {/* URL + bouton copier */}
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 rounded-[var(--r2)]
              bg-[var(--surface-2)] border border-[var(--border-1)]
              px-3 py-2.5 overflow-hidden">
              <p className="text-xs font-mono text-[var(--text-2)] truncate">
                {shareUrl}
              </p>
            </div>
            <CopyButton
              text={shareUrl}
              label="Copier"
              className="shrink-0 bg-[var(--cta-bg)] text-[var(--cta-fg)]
                hover:bg-white/90 border-transparent"
            />
          </div>

          {/* Partage social */}
          {shareUrls && (
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <span className="text-xs text-[var(--text-3)]">
                Partager sur :
              </span>
              <a
                href={shareUrls.twitter}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-[var(--r2)]
                  border border-[var(--border-1)] px-3 py-1.5 text-xs font-medium
                  text-[var(--text-2)] hover:border-[var(--border-2)]
                  hover:text-[var(--text-1)] transition-colors"
              >
                <Twitter className="h-3.5 w-3.5" />
                X / Twitter
              </a>
              <a
                href={shareUrls.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-[var(--r2)]
                  border border-[var(--border-1)] px-3 py-1.5 text-xs font-medium
                  text-[var(--text-2)] hover:border-[var(--border-2)]
                  hover:text-[var(--text-1)] transition-colors"
              >
                <Linkedin className="h-3.5 w-3.5" />
                LinkedIn
              </a>
            </div>
          )}
        </GlassCard>
      )}

      {/* ── CAPTION PRÊT-À-COPIER ── */}
      {shareUrl && (
        <GlassCard className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--text-1)]">
              Caption prêt à poster
            </h2>
            <CopyButton text={caption} label="Copier" labelCopied="Copié !" />
          </div>

          <div className="rounded-[var(--r2)] bg-[var(--surface-2)]
            border border-[var(--border-1)] p-4">
            <p className="text-xs text-[var(--text-2)] leading-relaxed
              whitespace-pre-line">
              {caption}
            </p>
          </div>

          <p className="text-[11px] text-[var(--text-3)]">
            Adapte ce texte à ta ligne éditoriale avant de poster.
          </p>
        </GlassCard>
      )}

      {/* ── RETOUR ── */}
      <div className="flex items-center justify-between pt-2">
        <Link
          href="/app/brand/contests"
          className="text-sm text-[var(--text-3)] hover:text-[var(--text-2)]
            transition-colors underline-offset-2 hover:underline"
        >
          ← Mes campagnes
        </Link>
        <Link
          href={`/app/brand/contests/${contestId}`}
          className="inline-flex items-center gap-1.5 text-xs
            text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          Voir le concours
        </Link>
      </div>
    </div>
  );
}
