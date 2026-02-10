'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { track } from '@/lib/analytics';

export interface ContestCardNetflixData {
  id: string;
  title: string;
  cover_url?: string | null;
  prize_pool_cents: number;
  currency: string;
  status: string;
  brand?: { display_name?: string | null; avatar_url?: string | null } | null;
}

function formatPrize(cents: number, currency: string): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency || 'EUR',
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

export function ContestCardNetflix({ contest }: { contest: ContestCardNetflixData }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      whileHover={{ scale: 1.03 }}
      transition={{ duration: 0.25 }}
      className="group relative aspect-[4/5] overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-xl"
    >
      <Link
        href={`/app/creator/contests/${contest.id}`}
        className="block h-full w-full"
        onClick={() => track('view_contest', { contest_id: contest.id, status: contest.status })}
      >
        {contest.cover_url ? (
          <Image
            src={contest.cover_url}
            alt={contest.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

        <div className="absolute top-3 left-3 z-10">
          {contest.brand?.avatar_url ? (
            <div className="relative h-10 w-10 overflow-hidden rounded-full border-2 border-white/30 bg-zinc-900">
              <Image
                src={contest.brand.avatar_url}
                alt={contest.brand.display_name || 'Marque'}
                fill
                className="object-cover"
              />
            </div>
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/50 text-xs font-bold text-white">
              {contest.brand?.display_name?.slice(0, 2).toUpperCase() ?? 'CR'}
            </div>
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="line-clamp-2 text-base font-semibold text-white drop-shadow-md">
            {contest.title}
          </h3>
          <p className="mt-1 text-lg font-bold text-emerald-400">
            {formatPrize(contest.prize_pool_cents, contest.currency)}
          </p>
          <span className="mt-2 inline-block rounded-lg bg-white/20 px-3 py-1.5 text-sm font-medium text-white opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100">
            Voir
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
