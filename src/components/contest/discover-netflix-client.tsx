'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { FeaturedContestCarousel } from './featured-contest-carousel';
import { CategoryFilter, filterContestsByCategory, type CategoryId } from './category-filter';
import { CATEGORIES } from './category-filter';
import { ContestCardNetflix } from './contest-card-netflix';
import type { ContestCardData } from '@/components/contest/contest-card';
import { EmptyState } from '@/components/creator/empty-state';
import { Button } from '@/components/ui/button';

export interface DiscoverNetflixClientProps {
  contests: ContestCardData[];
}

function toNetflixCard(c: ContestCardData) {
  return {
    id: c.id,
    title: c.title,
    cover_url: c.cover_url,
    prize_pool_cents: c.prize_pool_cents,
    currency: c.currency,
    status: c.status,
    brand: c.brand,
  };
}

export function DiscoverNetflixClient({ contests }: DiscoverNetflixClientProps) {
  const [category, setCategory] = useState<CategoryId>('all');

  const featured = useMemo(() => contests.slice(0, 3), [contests]);
  const filtered = useMemo(
    () => filterContestsByCategory(contests, category),
    [contests, category]
  );

  return (
    <div className="space-y-8">
      {featured.length > 0 && <FeaturedContestCarousel contests={featured} />}

      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">Explorer par catégorie</h2>
        <CategoryFilter active={category} onChange={setCategory} />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            {category === 'all' ? 'Tous les concours' : CATEGORIES.find((c) => c.id === category)?.label ?? category}
          </h2>
          <Button asChild variant="secondary" size="sm">
            <Link href="/app/creator/submissions">Mes soumissions</Link>
          </Button>
        </div>

        <AnimatePresence mode="popLayout">
          {filtered.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <EmptyState
                title="Aucun concours dans cette catégorie"
                description="Change de catégorie ou découvre tous les concours."
                action={{
                  label: 'Voir tous',
                  onClick: () => setCategory('all'),
                  variant: 'secondary',
                }}
              />
            </motion.div>
          ) : (
            <motion.div
              key={category}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
            >
              <AnimatePresence mode="popLayout">
                {filtered.map((contest) => (
                  <ContestCardNetflix key={contest.id} contest={toNetflixCard(contest)} />
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
