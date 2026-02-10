'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

function formatBalance(cents: number, currency: string): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency || 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export interface WalletBalanceCardProps {
  balanceCents: number;
  currency: string;
  stripeConnected?: boolean;
  onConfigurer?: () => void;
  configurerLoading?: boolean;
  children?: React.ReactNode;
  className?: string;
}

export function WalletBalanceCard({
  balanceCents,
  currency,
  stripeConnected = true,
  onConfigurer,
  configurerLoading = false,
  children,
  className,
}: WalletBalanceCardProps) {
  const [shimmer, setShimmer] = useState(false);
  const [displayBalance, setDisplayBalance] = useState(0);

  useEffect(() => {
    const duration = 500;
    const steps = 30;
    const step = balanceCents / steps;
    let current = 0;
    const t = setInterval(() => {
      current += step;
      if (current >= balanceCents) {
        setDisplayBalance(balanceCents);
        clearInterval(t);
        return;
      }
      setDisplayBalance(Math.round(current));
    }, duration / steps);
    return () => clearInterval(t);
  }, [balanceCents]);

  useEffect(() => {
    const runShimmer = () => {
      setShimmer(true);
      const t = setTimeout(() => setShimmer(false), 1100);
      return () => clearTimeout(t);
    };
    const id = setInterval(runShimmer, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'relative overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900',
        'border border-white/10 shadow-2xl',
        'min-h-[200px] p-6 flex flex-col justify-between',
        className
      )}
    >
      {/* Noise overlay */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_50%,rgba(255,255,255,0.03),transparent)]" />
      {/* Shimmer (toutes les 5s ou au survol) */}
      <div
        className={cn(
          'absolute inset-0 w-[60%] bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-1000 ease-out',
          shimmer ? 'translate-x-[200%]' : '-translate-x-full'
        )}
        onMouseEnter={() => {
          setShimmer(true);
          setTimeout(() => setShimmer(false), 1100);
        }}
      />
      <div className="relative z-10">
        <p className="text-xs font-medium uppercase tracking-widest text-white/50">Solde disponible</p>
        <p className="mt-1 font-semibold tracking-tight text-white tabular-nums text-[clamp(1.75rem,5vw,2.5rem)]">
          {formatBalance(displayBalance, currency)}
        </p>
      </div>
      <div className="relative z-10 mt-4">
        {!stripeConnected ? (
          <button
            type="button"
            onClick={onConfigurer}
            disabled={configurerLoading}
            className="rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/20 disabled:opacity-50"
          >
            {configurerLoading ? 'Redirection…' : 'Configurer le paiement'}
          </button>
        ) : (
          children
        )}
      </div>
    </motion.div>
  );
}
