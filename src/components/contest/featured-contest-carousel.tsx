'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Trophy } from 'lucide-react';
import type { ContestCardData } from '@/components/contest/contest-card';

function formatPrize(cents: number, currency: string): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency || 'EUR',
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

export interface FeaturedContestCarouselProps {
  contests: ContestCardData[];
}

export function FeaturedContestCarousel({ contests }: FeaturedContestCarouselProps) {
  if (contests.length === 0) return null;

  return (
    <section className="relative -mx-4 mb-8 overflow-hidden rounded-2xl md:mx-0">
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none md:grid md:grid-cols-3 md:overflow-visible">
        {contests.map((contest, index) => (
          <motion.div
            key={contest.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: index * 0.08 }}
            className="min-w-[85vw] shrink-0 md:min-w-0"
          >
            <Link href={`/app/creator/contests/${contest.id}`} className="block">
              <div className="group relative aspect-[16/10] overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 md:aspect-[3/2]">
                {contest.cover_url ? (
                  <Image
                    src={contest.cover_url}
                    alt={contest.title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 768px) 90vw, 33vw"
                    priority={index < 2}
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                <div className="absolute top-3 right-3">
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/90 px-2.5 py-1 text-xs font-bold text-black">
                    <Trophy className="h-3.5 w-3.5" />
                    Top Reward
                  </span>
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-4 md:p-5">
                  <h2 className="line-clamp-2 text-xl font-bold tracking-tight text-white drop-shadow-lg md:text-2xl">
                    {contest.title}
                  </h2>
                  <p className="mt-1 text-lg font-semibold text-emerald-400">
                    {formatPrize(contest.prize_pool_cents, contest.currency)} à gagner
                  </p>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
