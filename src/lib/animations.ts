/**
 * Système d'animations optimisé pour ClipRace
 * Gestion intelligente des animations avec respect des préférences utilisateur
 */

import { useState, useRef, useEffect, useCallback } from 'react';

// Types pour les animations
export type AnimationType = 'fade' | 'slide' | 'scale' | 'float' | 'marquee' | 'orb' | 'card';
export type AnimationDirection = 'up' | 'down' | 'left' | 'right' | 'in' | 'out';
export type AnimationEasing = 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'bounce' | 'smooth';

// Configuration des animations
export interface AnimationConfig {
  type: AnimationType;
  direction?: AnimationDirection;
  duration?: number;
  delay?: number;
  easing?: AnimationEasing;
  iterations?: number | 'infinite';
  fillMode?: 'none' | 'forwards' | 'backwards' | 'both';
  playState?: 'running' | 'paused';
}

// Configuration par défaut
export const defaultAnimationConfig: AnimationConfig = {
  type: 'fade',
  duration: 300,
  delay: 0,
  easing: 'ease-out',
  iterations: 1,
  fillMode: 'both',
  playState: 'running',
};

// Détection des préférences utilisateur
export const getUserPreferences = () => {
  if (typeof window === 'undefined') return { reducedMotion: false, highContrast: false };
  
  return {
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    highContrast: window.matchMedia('(prefers-contrast: high)').matches,
  };
};

// Configuration des animations basée sur les préférences
export const getAnimationConfig = (config: Partial<AnimationConfig> = {}): AnimationConfig => {
  const preferences = getUserPreferences();
  const finalConfig = { ...defaultAnimationConfig, ...config };
  
  // Réduire les animations si l'utilisateur le préfère
  if (preferences.reducedMotion) {
    return {
      ...finalConfig,
      duration: 0,
      delay: 0,
      iterations: 1,
    };
  }
  
  return finalConfig;
};

// Classes d'animation CSS
export const animationClasses: Record<AnimationType, any> = {
  fade: {
    in: 'animate-fade-in',
    out: 'opacity-0',
  },
  slide: {
    up: 'animate-slide-up',
    down: 'animate-slide-down',
    left: 'animate-slide-left',
    right: 'animate-slide-right',
  },
  scale: {
    in: 'animate-scale-in',
    out: 'animate-scale-out',
  },
  float: 'animate-floaty',
  marquee: 'animate-marquee',
  orb: 'animate-orb-float',
  card: 'animate-float-card',
};

// Hook pour les animations reveal
export const useRevealAnimation = (
  threshold: number = 0.1,
  rootMargin: string = '-10% 0px -10% 0px'
) => {
  if (typeof window === 'undefined') return { isVisible: false, ref: null };
  
  const [isVisible, setIsVisible] = useState(false);
  const [hasBeenVisible, setHasBeenVisible] = useState(false);
  const ref = useRef<HTMLElement>(null);
  
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            setHasBeenVisible(true);
          }
        });
      },
      { threshold, rootMargin }
    );
    
    observer.observe(element);
    
    return () => {
      observer.unobserve(element);
    };
  }, [threshold, rootMargin]);
  
  return { isVisible, hasBeenVisible, ref };
};

// Hook pour les animations de parallax
export const useParallaxAnimation = (speed: number = 0.5) => {
  const [offset, setOffset] = useState(0);
  
  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.pageYOffset;
      setOffset(scrolled * speed);
    };
    
    // Throttle pour les performances
    let ticking = false;
    const throttledScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };
    
    window.addEventListener('scroll', throttledScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', throttledScroll);
    };
  }, [speed]);
  
  return offset;
};

// Hook pour les animations de particules
export const useParticleAnimation = (particleCount: number = 20) => {
  const [particles, setParticles] = useState<Array<{
    id: number;
    x: number;
    y: number;
    size: number;
    speed: number;
    opacity: number;
  }>>([]);
  
  useEffect(() => {
    const newParticles = Array.from({ length: particleCount }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 4 + 2,
      speed: Math.random() * 0.5 + 0.1,
      opacity: Math.random() * 0.5 + 0.2,
    }));
    
    setParticles(newParticles);
  }, [particleCount]);
  
  return particles;
};

// Hook pour les animations de marquee
export const useMarqueeAnimation = (speed: number = 1) => {
  const [position, setPosition] = useState(0);
  
  useEffect(() => {
    const animate = () => {
      setPosition(prev => (prev + speed) % 100);
      requestAnimationFrame(animate);
    };
    
    const animationId = requestAnimationFrame(animate);
    
    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [speed]);
  
  return position;
};

// Hook pour les animations d'orbes
export const useOrbAnimation = () => {
  const [orbPositions, setOrbPositions] = useState({
    orb1: { x: 0, y: 0, scale: 1 },
    orb2: { x: 0, y: 0, scale: 1 },
  });
  
  useEffect(() => {
    const animate = () => {
      const time = Date.now() * 0.001;
      
      setOrbPositions({
        orb1: {
          x: Math.sin(time * 0.5) * 20,
          y: Math.cos(time * 0.3) * 15,
          scale: 1 + Math.sin(time * 0.7) * 0.1,
        },
        orb2: {
          x: Math.cos(time * 0.4) * 25,
          y: Math.sin(time * 0.6) * 20,
          scale: 1 + Math.cos(time * 0.8) * 0.15,
        },
      });
      
      requestAnimationFrame(animate);
    };
    
    const animationId = requestAnimationFrame(animate);
    
    return () => {
      cancelAnimationFrame(animationId);
    };
  }, []);
  
  return orbPositions;
};

// Utilitaires pour les animations
export const createAnimationStyle = (config: AnimationConfig) => {
  const { duration, delay, easing, iterations, fillMode, playState } = config;
  
  return {
    animationDuration: `${duration}ms`,
    animationDelay: `${delay}ms`,
    animationTimingFunction: easing,
    animationIterationCount: iterations,
    animationFillMode: fillMode,
    animationPlayState: playState,
  };
};

// Détection des performances
export const getPerformanceLevel = (): 'low' | 'medium' | 'high' => {
  if (typeof window === 'undefined') return 'medium';
  
  // Détection basée sur les capacités du navigateur
  const connection = (navigator as any).connection;
  const memory = (performance as any).memory;
  
  if (connection) {
    if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
      return 'low';
    }
    if (connection.effectiveType === '3g') {
      return 'medium';
    }
  }
  
  if (memory) {
    const usedMemory = memory.usedJSHeapSize / memory.totalJSHeapSize;
    if (usedMemory > 0.8) return 'low';
    if (usedMemory > 0.6) return 'medium';
  }
  
  return 'high';
};

// Configuration des animations basée sur les performances
export const getPerformanceOptimizedConfig = (baseConfig: AnimationConfig): AnimationConfig => {
  const performanceLevel = getPerformanceLevel();
  
  switch (performanceLevel) {
    case 'low':
      return {
        ...baseConfig,
        duration: Math.min(baseConfig.duration || 300, 200),
        iterations: 1,
      };
    case 'medium':
      return {
        ...baseConfig,
        duration: Math.min(baseConfig.duration || 300, 400),
      };
    case 'high':
    default:
      return baseConfig;
  }
};

// Hook principal pour les animations
export const useAnimation = (config: Partial<AnimationConfig> = {}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationClass, setAnimationClass] = useState('');
  
  const startAnimation = useCallback(() => {
    const finalConfig = getPerformanceOptimizedConfig(getAnimationConfig(config));
    const classes = animationClasses[finalConfig.type];
    
    if (typeof classes === 'string') {
      setAnimationClass(classes);
    } else if (finalConfig.direction && typeof classes === 'object' && classes[finalConfig.direction as keyof typeof classes]) {
      setAnimationClass(classes[finalConfig.direction as keyof typeof classes]);
    }
    
    setIsAnimating(true);
    
    // Reset après l'animation
    if (finalConfig.duration && finalConfig.duration > 0) {
      setTimeout(() => {
        setIsAnimating(false);
        setAnimationClass('');
      }, finalConfig.duration);
    }
  }, [config]);
  
  return {
    isAnimating,
    animationClass,
    startAnimation,
  };
};

// Les hooks sont déjà exportés individuellement ci-dessus
