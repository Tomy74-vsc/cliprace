/**
 * Composant de section avec lazy loading optimisé
 * Améliore les performances en chargeant le contenu seulement quand nécessaire
 */

import { useState, useRef, useEffect, ReactNode } from 'react';
import { getIntersectionConfig } from '@/lib/performance';

interface LazySectionProps {
  children: ReactNode;
  className?: string;
  threshold?: number;
  rootMargin?: string;
  fallback?: ReactNode;
  onVisible?: () => void;
}

export function LazySection({
  children,
  className = '',
  threshold = 0.1,
  rootMargin = '-10% 0px -10% 0px',
  fallback,
  onVisible,
}: LazySectionProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasBeenVisible, setHasBeenVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            setHasBeenVisible(true);
            onVisible?.();
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold,
        rootMargin,
      }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => {
      if (sectionRef.current) {
        observer.unobserve(sectionRef.current);
      }
    };
  }, [threshold, rootMargin, onVisible]);

  return (
    <div ref={sectionRef} className={className}>
      {isVisible || hasBeenVisible ? (
        children
      ) : (
        fallback || (
          <div className="animate-pulse">
            <div className="h-8 bg-zinc-200 dark:bg-zinc-800 rounded mb-4" />
            <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded mb-2" />
            <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-3/4" />
          </div>
        )
      )}
    </div>
  );
}

// Composant spécialisé pour les listes
export function LazyList<T>({
  items,
  renderItem,
  className = '',
  itemClassName = '',
  threshold = 0.1,
  batchSize = 10,
}: {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  className?: string;
  itemClassName?: string;
  threshold?: number;
  batchSize?: number;
}) {
  const [visibleCount, setVisibleCount] = useState(batchSize);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && visibleCount < items.length) {
            setIsLoading(true);
            setTimeout(() => {
              setVisibleCount(prev => Math.min(prev + batchSize, items.length));
              setIsLoading(false);
            }, 100);
          }
        });
      },
      {
        threshold,
        rootMargin: '100px 0px',
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      if (containerRef.current) {
        observer.unobserve(containerRef.current);
      }
    };
  }, [visibleCount, items.length, batchSize, threshold]);

  return (
    <div className={className}>
      {items.slice(0, visibleCount).map((item, index) => (
        <div key={index} className={itemClassName}>
          {renderItem(item, index)}
        </div>
      ))}
      
      {visibleCount < items.length && (
        <div ref={containerRef} className="flex justify-center py-8">
          {isLoading ? (
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
          ) : (
            <div className="text-zinc-500 text-sm">
              Chargement de plus d'éléments...
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Hook pour le lazy loading
export function useLazyLoad(
  threshold = 0.1,
  rootMargin = '0px 0px 100px 0px'
) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasBeenVisible, setHasBeenVisible] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            setHasBeenVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold,
        rootMargin,
      }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, [threshold, rootMargin]);

  return { ref, isVisible, hasBeenVisible };
}
