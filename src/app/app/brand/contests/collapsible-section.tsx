'use client';

import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

interface CollapsibleSectionProps {
  defaultCollapsed?: boolean;
  initialVisibleCount?: number;
  totalCount: number;
  children: (visibleCount: number) => ReactNode;
}

export function CollapsibleSection({
  defaultCollapsed = false,
  initialVisibleCount = 3,
  totalCount,
  children,
}: CollapsibleSectionProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const safeInitial = Math.max(0, Math.min(initialVisibleCount, totalCount));
  const visibleCount = collapsed ? safeInitial : totalCount;
  const hiddenCount = totalCount - safeInitial;

  return (
    <div className="space-y-3">
      <AnimatePresence initial={false}>
        <motion.div
          key={collapsed ? 'collapsed' : 'expanded'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
        >
          {children(visibleCount)}
        </motion.div>
      </AnimatePresence>

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          className="inline-flex items-center gap-1.5 text-xs font-medium 
            text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors
            focus-visible:outline-none focus-visible:ring-2 
            focus-visible:ring-[var(--accent)]"
        >
          <motion.span
            animate={{ rotate: collapsed ? 0 : 180 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </motion.span>
          {collapsed
            ? `Voir ${hiddenCount} campagne${hiddenCount > 1 ? 's' : ''} de plus`
            : 'Réduire'}
        </button>
      )}
    </div>
  );
}


