/**
 * ClipRace — Dictionnaire central des springs Framer Motion
 * Source de vérité unique. Toute animation doit importer depuis ce fichier.
 * ❌ INTERDIT : transition={{ duration: 0.25, ease: 'easeOut' }}
 * ✅ OBLIGATOIRE : transition={springVif}
 */

export const springVif = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 30,
  mass: 0.8,
};

export const springDoux = {
  type: 'spring' as const,
  stiffness: 150,
  damping: 20,
  mass: 1.0,
};

export const springAmbiante = {
  type: 'spring' as const,
  stiffness: 80,
  damping: 15,
  mass: 1.2,
};

export const springFeedback = {
  type: 'spring' as const,
  stiffness: 600,
  damping: 40,
};

export const stagger = {
  staggerChildren: 0.05,
  delayChildren: 0.1,
};

/**
 * Utilisation avec prefers-reduced-motion :
 * const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
 * const spring = prefersReduced ? { duration: 0 } : springVif
 */

