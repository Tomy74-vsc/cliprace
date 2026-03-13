'use client';

import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { WizardFormData, Platform } from '../../_types';
import { Surface } from '@/components/brand-ui/Surface';
import { cn } from '@/lib/utils';

type Props = {
  data: WizardFormData;
};

function formatCurrency(cents: number, currency: 'EUR' | 'USD') {
  if (!cents || cents <= 0) return '—';
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDateLabel(date: Date | null) {
  if (!date) return '—';
  return date.toLocaleDateString(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function diffInDays(start: Date | null, end: Date | null) {
  if (!start || !end) return null;
  const ms = end.getTime() - start.getTime();
  if (ms <= 0) return null;
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

const PLATFORM_LABEL: Record<Platform, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  youtube: 'YouTube',
  twitter: 'Twitter',
};

export function StepReview({ data }: Props) {
  const durationDays = diffInDays(data.startAt, data.endAt);
  const hasCover = Boolean(data.coverUrl);

  const checklist = [
    { label: 'Title set', ok: data.title.trim().length >= 5 },
    { label: 'Brief written', ok: data.briefMd.trim().length >= 20 },
    { label: 'Platform(s) selected', ok: data.networks.length > 0 },
    { label: 'Budget defined', ok: data.budgetCents >= 10_000 },
    {
      label: 'Dates set',
      ok: Boolean(data.startAt && data.endAt && durationDays && durationDays > 0),
    },
    {
      label: 'Cover image (optional but recommended)',
      ok: hasCover,
      optional: true,
    },
  ] as const;

  return (
    <div className="space-y-6">
      <Surface variant="track" className="p-6 md:p-8">
        {data.coverUrl && (
          <div className="mb-6 overflow-hidden rounded-[var(--r3)] border border-[var(--border-1)] bg-[var(--surface-2)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={data.coverUrl}
              alt="Contest cover preview"
              className="h-32 w-full object-cover sm:h-40"
            />
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
                Title
              </div>
              <div className="mt-1 text-sm font-medium text-[var(--text-1)]">
                {data.title || 'Not set yet'}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
                Platforms
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {data.networks.length === 0 ? (
                  <span className="text-xs text-[var(--text-3)]">No platform selected</span>
                ) : (
                  data.networks.map((p) => (
                    <span
                      key={p}
                      className="inline-flex items-center rounded-[var(--r-pill)] border border-[var(--border-2)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-2)]"
                    >
                      {PLATFORM_LABEL[p]}
                    </span>
                  ))
                )}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
                Brief
              </div>
              <div className="mt-1 text-xs text-[var(--text-2)]">
                {data.briefMd
                  ? `${data.briefMd.slice(0, 100)}${
                      data.briefMd.length > 100 ? '…' : ''
                    }`
                  : 'No brief yet.'}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
                Budget
              </div>
              <div className="mt-1 text-sm text-[var(--text-1)]">
                {formatCurrency(data.budgetCents, data.currency)}{' '}
                <span className="text-[var(--text-3)]">total</span>
              </div>
            </div>

            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
                Prize pool
              </div>
              <div className="mt-1 text-sm text-[var(--text-1)]">
                {formatCurrency(data.prizePoolCents, data.currency)}{' '}
                <span className="text-[var(--text-3)]">
                  for up to {data.maxWinners || 1} winner
                  {data.maxWinners > 1 ? 's' : ''}
                </span>
              </div>
            </div>

            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
                Duration
              </div>
              <div className="mt-1 text-sm text-[var(--text-1)]">
                {durationDays
                  ? `${durationDays} day${durationDays > 1 ? 's' : ''} (${formatDateLabel(
                      data.startAt,
                    )} → ${formatDateLabel(data.endAt)})`
                  : 'Dates not fully set'}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 h-px w-full bg-[var(--border-1)]" />

        <div className="mt-4 space-y-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
            Pre‑publish checklist
          </div>
          <ul className="space-y-2">
            {checklist.map((item) => (
              <li key={item.label} className="flex items-start gap-2 text-xs">
                {item.ok ? (
                  <CheckCircle2 className="mt-[1px] h-4 w-4 text-[var(--accent)]" />
                ) : (
                  <AlertCircle className="mt-[1px] h-4 w-4 text-[var(--warning)]" />
                )}
                <span
                  className={cn(
                    'text-[var(--text-2)]',
                    !item.ok && !item.optional && 'text-[var(--danger)]',
                  )}
                >
                  {item.label}
                  {item.optional ? ' (optional)' : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Surface>
    </div>
  );
}

