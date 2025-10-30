/**
 * Optimisations de performance pour ClipRace
 * Gestion du lazy loading, des animations et des ressources
 */

// Configuration des animations pour les appareils avec préférence de mouvement réduit
export const getAnimationConfig = () => {
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return {
      duration: 0,
      ease: 'linear',
      stagger: 0,
    };
  }
  
  return {
    duration: 0.3,
    ease: 'easeOut',
    stagger: 0.1,
  };
};

// Configuration du lazy loading pour les images
export const getImageConfig = () => ({
  loading: 'lazy' as const,
  decoding: 'async' as const,
  fetchPriority: 'auto' as const,
});

// Configuration des intersections pour les animations reveal
export const getIntersectionConfig = () => ({
  root: null,
  rootMargin: '-10% 0px -10% 0px',
  threshold: 0.1,
});

// Debounce pour les événements de scroll
export const debounce = <T extends (...args: any[]) => void>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// Throttle pour les événements de scroll
export const throttle = <T extends (...args: any[]) => void>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

// Configuration des métriques de performance
export const performanceConfig = {
  // Seuils pour les métriques Core Web Vitals
  thresholds: {
    LCP: 2500, // Largest Contentful Paint
    FID: 100,  // First Input Delay
    CLS: 0.1,  // Cumulative Layout Shift
  },
  
  // Configuration du monitoring
  monitoring: {
    enabled: process.env.NODE_ENV === 'production',
    sampleRate: 0.1, // 10% des utilisateurs
  },
};

// Optimisation des fonts
export const fontOptimization = {
  display: 'swap' as const,
  preload: true,
  fallback: [
    'system-ui',
    '-apple-system',
    'Segoe UI',
    'Roboto',
    'Arial',
    'Helvetica',
    'sans-serif',
  ],
};

// Configuration du cache pour les ressources statiques
export const cacheConfig = {
  static: {
    maxAge: 31536000, // 1 an
    sMaxAge: 31536000,
  },
  dynamic: {
    maxAge: 0,
    sMaxAge: 86400, // 1 jour
  },
  api: {
    maxAge: 0,
    sMaxAge: 300, // 5 minutes
  },
};

// Configuration des animations CSS pour les performances
export const animationConfig = {
  // Utiliser transform et opacity pour de meilleures performances
  hardwareAccelerated: {
    transform: 'translateZ(0)',
    willChange: 'transform, opacity',
  },
  
  // Animations optimisées
  optimized: {
    duration: '0.3s',
    timingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    fillMode: 'both',
  },
};

// Configuration du preloading des ressources critiques
export const preloadConfig = {
  critical: [
    '/fonts/poppins-regular.woff2',
    '/fonts/poppins-semibold.woff2',
  ],
  important: [
    '/api/contests',
    '/api/leaderboards',
  ],
};

// Fonction pour optimiser les images
export const optimizeImage = (src: string, width?: number, height?: number) => {
  const params = new URLSearchParams();
  
  if (width) params.set('w', width.toString());
  if (height) params.set('h', height.toString());
  params.set('q', '80'); // Qualité
  params.set('f', 'webp'); // Format
  
  return `${src}?${params.toString()}`;
};

// Configuration du service worker (si implémenté)
export const serviceWorkerConfig = {
  enabled: process.env.NODE_ENV === 'production',
  scope: '/',
  updateInterval: 24 * 60 * 60 * 1000, // 24 heures
};
