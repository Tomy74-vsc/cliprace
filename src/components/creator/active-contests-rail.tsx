'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PlatformBadge } from '@/components/creator/platform-badge';
import type { Platform } from '@/lib/validators/platforms';
import { formatCurrency } from '@/lib/formatters';

export type ActiveContestCard = {
  id: string;
  title: string;
  coverUrl?: string | null;
  brandName?: string | null;
  brandAvatarUrl?: string | null;
  prizePoolCents: number;
  currency: string;
  endAt: string;
  networks: Platform[];
};

function formatTimeLeft(endAt: string) {
  const now = new Date();
  const end = new Date(endAt);
  const diffMs = end.getTime() - now.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (diffMs <= 0) return 'Terminé';
  if (days > 0) return `Se termine dans ${days} jour${days > 1 ? 's' : ''}`;
  if (hours > 0) return `Se termine dans ${hours}h`;
  return `Se termine dans ${minutes} min`;
}

export function ActiveContestsRail({ contests }: { contests: ActiveContestCard[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const update = () => {
      const maxScroll = el.scrollWidth - el.clientWidth;
      setCanScrollPrev(el.scrollLeft > 8);
      setCanScrollNext(el.scrollLeft < maxScroll - 8);
    };

    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [contests.length]);

  const scrollBy = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const offset = direction === 'left' ? -el.clientWidth * 0.9 : el.clientWidth * 0.9;
    el.scrollBy({ left: offset, behavior: 'smooth' });
  };

  return (
    <div className="relative">
      <div className="absolute left-0 top-1/2 z-10 -translate-y-1/2 hidden md:flex">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          aria-label="Voir les concours précédents"
          onClick={() => scrollBy('left')}
          disabled={!canScrollPrev}
          className="h-10 w-10 rounded-full shadow-card"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>
      <div className="absolute right-0 top-1/2 z-10 -translate-y-1/2 hidden md:flex">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          aria-label="Voir les concours suivants"
          onClick={() => scrollBy('right')}
          disabled={!canScrollNext}
          className="h-10 w-10 rounded-full shadow-card"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-2 pr-2 snap-x snap-mandatory scroll-smooth"
        aria-label="Concours actifs"
      >
        {contests.map((contest) => (
          <article
            key={contest.id}
            className="snap-start shrink-0 w-[260px] sm:w-[300px] lg:w-[340px]"
            aria-label={contest.title}
          >
            <div className="group relative h-full overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-transform duration-300 hover:-translate-y-1 hover:shadow-card-hover">
              <div className="relative h-40 w-full overflow-hidden bg-muted">
                {contest.coverUrl ? (
                  <Image
                    src={contest.coverUrl}
                    alt={contest.title}
                    fill
                    sizes="320px"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    priority={false}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-r from-primary/15 to-accent/15 text-sm font-semibold text-muted-foreground">
                    Concours ClipRace
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                <div className="absolute left-3 right-3 top-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {contest.brandAvatarUrl ? (
                      <div className="relative h-8 w-8 overflow-hidden rounded-full border border-white/40 shadow">
                        <Image
                          src={contest.brandAvatarUrl}
                          alt={contest.brandName || 'Marque'}
                          fill
                          sizes="32px"
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-xs font-semibold text-white shadow">
                        {(contest.brandName || 'CR').slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="text-white drop-shadow-sm">
                      <p className="text-[11px] uppercase tracking-wide opacity-80">Marque</p>
                      <p className="text-sm font-semibold leading-tight">
                        {contest.brandName || 'ClipRace'}
                      </p>
                    </div>
                  </div>
                  <Badge variant="success" className="bg-white/15 text-white backdrop-blur">
                    Actif
                  </Badge>
                </div>
                <div className="absolute bottom-3 left-3 flex items-center gap-2 text-xs font-medium text-white drop-shadow">
                  <Clock className="h-4 w-4" />
                  <span>{formatTimeLeft(contest.endAt)}</span>
                </div>
              </div>

              <div className="space-y-3 p-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Trophy className="h-4 w-4 text-primary" />
                    <span>{formatCurrency(contest.prizePoolCents, contest.currency)}</span>
                  </div>
                  <h3 className="line-clamp-2 text-base font-semibold text-foreground">{contest.title}</h3>
                </div>

                {contest.networks.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {contest.networks.map((platform) => (
                      <PlatformBadge key={platform} platform={platform} className="bg-muted/60" />
                    ))}
                  </div>
                )}

                <Button asChild size="sm" className="w-full justify-center">
                  <Link href={`/app/creator/contests/${contest.id}`}>Participer</Link>
                </Button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export function ActiveContestsCarouselSkeleton() {
  return (
    <div className="flex gap-4 overflow-hidden">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="w-[260px] sm:w-[300px] lg:w-[340px] shrink-0">
          <div className="h-full rounded-2xl border border-border bg-card p-4 shadow-card space-y-3">
            <div className="h-40 w-full rounded-xl bg-muted animate-pulse" />
            <div className="h-4 w-24 rounded bg-muted animate-pulse" />
            <div className="h-5 w-4/5 rounded bg-muted animate-pulse" />
            <div className="flex gap-2">
              <div className="h-6 w-16 rounded-full bg-muted animate-pulse" />
              <div className="h-6 w-16 rounded-full bg-muted animate-pulse" />
            </div>
            <div className="h-10 w-full rounded-full bg-muted animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
