'use client';

import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';

const transition = { duration: 0.25, ease: [0.32, 0.72, 0, 1] };

export function BrandPageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={transition}
        className="min-h-0 flex flex-col"
        style={{ willChange: 'opacity, transform' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
