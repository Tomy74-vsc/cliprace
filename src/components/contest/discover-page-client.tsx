/*
Source: Component DiscoverPageClient
Purpose: Client shell for discover filters + pagination (query-string sync)
*/
'use client';

import { useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ContestCard, type ContestCardData } from '@/components/contest/contest-card';
import { DiscoverFilters } from '@/components/contest/discover-filters';
import { Trophy } from 'lucide-react';
import type { Platform } from '@/lib/validators/platforms';
import { EmptyState } from '@/components/creator/empty-state';
import { ContestCardSkeleton } from '@/components/creator/skeletons';

interface DiscoverPageClientProps {
  contests: ContestCardData[];
  total: number;
  page: number;
  pageSize: number;
  filters: {
    search: string;
    platforms: Platform[];
  };
}

export function DiscoverPageClient({
  contests,
  total,
  page,
  pageSize,
  filters,
}: DiscoverPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const updateQuery = (next: { search?: string; platforms?: Platform[]; page?: number }) => {
    const params = new URLSearchParams(searchParams.toString());

    if (next.search !== undefined) {
      if (next.search) params.set('search', next.search);
      else params.delete('search');
    }

    if (next.platforms !== undefined) {
      if (next.platforms.length) {
        params.set('platforms', next.platforms.join(','));
      } else {
        params.delete('platforms');
      }
    }

    if (next.page !== undefined) {
      if (next.page > 1) params.set('page', String(next.page));
      else params.delete('page');
    } else {
      params.delete('page');
    }

    startTransition(() => {
      router.replace(`?${params.toString()}`, { scroll: false });
    });
  };

  const handleFiltersChange = (value: { search: string; platforms: Platform[] }) => {
    updateQuery({ search: value.search, platforms: value.platforms, page: 1 });
  };

  const handlePageChange = (nextPage: number) => {
    updateQuery({ page: nextPage });
  };

  return (
    <div className="space-y-8" aria-live="polite">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <DiscoverFilters value={filters} isPending={isPending} onFiltersChange={handleFiltersChange} />
      </motion.div>

      {total > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <Trophy className="h-4 w-4 text-primary" aria-hidden="true" />
          <span>
            {total} concours{total > 1 ? 's' : ''} trouvé{total > 1 ? 's' : ''}
          </span>
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {isPending ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <ContestCardSkeleton key={i} />
            ))}
          </motion.div>
        ) : contests.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <EmptyState
              title={
                filters.search || filters.platforms.length > 0
                  ? 'Aucun concours trouvé'
                  : 'Aucun concours actif'
              }
              description={
                filters.search || filters.platforms.length > 0
                  ? 'Modifie tes filtres pour voir plus de résultats.'
                  : 'Reviens bientôt pour découvrir de nouveaux concours.'
              }
              action={{
                label: 'Réinitialiser',
                onClick: () => updateQuery({ search: '', platforms: [], page: 1 }),
                variant: 'secondary',
              }}
            />
          </motion.div>
        ) : (
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            role="list"
            aria-busy={isPending}
          >
            <AnimatePresence>
              {contests.map((contest, index) => (
                <motion.div
                  key={contest.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  role="listitem"
                >
                  <ContestCard contest={contest} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {totalPages > 1 && (
        <PaginationControls page={page} totalPages={totalPages} isPending={isPending} onPageChange={handlePageChange} />
      )}
    </div>
  );
}

interface PaginationControlsProps {
  page: number;
  totalPages: number;
  isPending: boolean;
  onPageChange: (page: number) => void;
}

function PaginationControls({ page, totalPages, isPending, onPageChange }: PaginationControlsProps) {
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <nav
      className="flex items-center justify-between border-t border-border pt-6"
      aria-label="Pagination"
    >
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={!canPrev || isPending}
        className="text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
      >
        Précédent
      </button>
      <div className="text-sm text-muted-foreground" aria-live="polite">
        Page {page} sur {totalPages}
      </div>
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={!canNext || isPending}
        className="text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
      >
        Suivant
      </button>
    </nav>
  );
}
