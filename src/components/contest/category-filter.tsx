'use client';

import { motion } from 'framer-motion';

export type CategoryId = 'all' | 'beaute' | 'tech' | 'mode' | 'sport' | 'ugc';

export const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'beaute', label: 'Beauté' },
  { id: 'tech', label: 'Tech' },
  { id: 'mode', label: 'Mode' },
  { id: 'sport', label: 'Sport' },
  { id: 'ugc', label: 'UGC Only' },
];

export interface CategoryFilterProps {
  active: CategoryId;
  onChange: (id: CategoryId) => void;
  className?: string;
}

export function CategoryFilter({ active, onChange, className }: CategoryFilterProps) {
  return (
    <div className={`flex gap-2 overflow-x-auto pb-2 scrollbar-none ${className ?? ''}`}
      {CATEGORIES.map((cat) => {
        const isActive = active === cat.id;
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onChange(cat.id)}
            className="relative shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {isActive && (
              <motion.span
                layoutId="category-pill"
                className="absolute inset-0 rounded-full bg-white/15 ring-1 ring-white/20 dark:bg-white/10 dark:ring-white/10"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10">{cat.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function filterContestsByCategory<T extends { title?: string | null; brief_md?: string | null; min_followers?: number | null }>(
  contests: T[],
  category: CategoryId
): T[] {
  if (category === 'all') return contests;
  if (category === 'ugc') {
    return contests.filter((c) => !c.min_followers || c.min_followers === 0);
  }
  const keywords: Record<CategoryId, string[]> = {
    all: [],
    beaute: ['beauté', 'beaute', 'cosmétique', 'makeup', 'skincare'],
    tech: ['tech', 'technologie', 'gaming', 'app', 'digital'],
    mode: ['mode', 'fashion', 'style', 'vêtement'],
    sport: ['sport', 'fitness', 'running', 'musculation'],
    ugc: [],
  };
  const terms = keywords[category];
  if (!terms.length) return contests;
  const text = (c: T) => `${(c.title ?? '').toLowerCase()} ${(c.brief_md ?? '').toLowerCase()}`;
  return contests.filter((c) => terms.some((t) => text(c).includes(t)));
}
