'use client';

import { motion } from 'framer-motion';

export function CommandIsland() {
  return (
    <motion.div
      className="fixed top-6 left-1/2 -translate-x-1/2 z-50"
      initial={{ opacity: 0, y: -10, filter: 'blur(10px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
    >
      <div className="h-12 rounded-full bg-white/5 backdrop-blur-3xl border border-white/10 ring-1 ring-inset ring-white/5 shadow-2xl flex items-center px-4 gap-4">
        <span className="text-[13px] font-medium text-zinc-300">Portfolio</span>
        <span
          aria-hidden="true"
          className="size-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_#10b981]"
        />
        <kbd className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
          ⌘K
        </kbd>
      </div>
    </motion.div>
  );
}

