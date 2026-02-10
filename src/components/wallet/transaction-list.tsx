'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export interface TransactionItem {
  id: string;
  contestTitle: string;
  payoutCents: number;
  createdAt: string;
  brandAvatarUrl?: string | null;
}

export interface TransactionListProps {
  transactions: TransactionItem[];
  currency?: string;
  className?: string;
}

function formatTime(dateString: string): string {
  const d = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `Il y a ${diffMins} min`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function formatAmount(cents: number, currency: string): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency || 'EUR',
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

type GroupKey = 'today' | 'yesterday' | 'week';

function getGroupKey(dateString: string): GroupKey {
  const d = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - 7);
  const t = d.getTime();
  if (t >= today.getTime()) return 'today';
  if (t >= yesterday.getTime()) return 'yesterday';
  if (t >= weekStart.getTime()) return 'week';
  return 'week';
}

const GROUP_LABELS: Record<GroupKey, string> = {
  today: "Aujourd'hui",
  yesterday: 'Hier',
  week: 'Cette semaine',
};

export function TransactionList({
  transactions,
  currency = 'EUR',
  className,
}: TransactionListProps) {
  const grouped = useMemo(() => {
    const map = new Map<GroupKey, TransactionItem[]>();
    const order: GroupKey[] = ['today', 'yesterday', 'week'];
    order.forEach((k) => map.set(k, []));
    [...transactions]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .forEach((t) => {
        const key = getGroupKey(t.createdAt);
        map.get(key)?.push(t);
      });
    return order.map((key) => ({ key, items: map.get(key) ?? [] })).filter((g) => g.items.length > 0);
  }, [transactions]);

  if (transactions.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={`rounded-2xl border border-white/10 bg-zinc-900/50 p-6 text-center text-sm text-white/50 ${className ?? ''}`}
      >
        Aucune transaction pour l&apos;instant
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.15 }}
      className={className}
    >
      <p className="mb-3 text-xs font-medium uppercase tracking-wider text-white/50">Historique</p>
      <div className="rounded-2xl border border-white/10 bg-zinc-900/50 overflow-hidden">
        {grouped.map(({ key, items }) => (
          <div key={key}>
            <p className="bg-white/5 px-4 py-2 text-xs font-medium text-white/60">
              {GROUP_LABELS[key]}
            </p>
            <ul className="divide-y divide-white/5">
              {items.map((t, i) => (
                <motion.li
                  key={t.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * i }}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <span className="flex items-center gap-3 min-w-0 flex-1">
                    <Avatar className="h-10 w-10 shrink-0 rounded-full border border-white/10 bg-white/5">
                      {t.brandAvatarUrl ? (
                        <img src={t.brandAvatarUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <AvatarFallback className="rounded-full bg-emerald-500/20 text-xs font-medium text-emerald-400">
                          {t.contestTitle.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-white">
                        {t.contestTitle}
                      </span>
                      <span className="block text-xs text-white/50">{formatTime(t.createdAt)}</span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-emerald-400 tabular-nums">
                      +{formatAmount(t.payoutCents, currency)}
                    </span>
                  </span>
                </motion.li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
