'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

type AdminStaggerListProps = {
  children: ReactNode[];
  className?: string;
  staggerDelay?: number;
  animationDuration?: number;
};

/**
 * Liste avec animation stagger (apparition progressive)
 * Les éléments apparaissent un par un avec un délai
 */
export function AdminStaggerList({
  children,
  className,
  staggerDelay = 50,
  animationDuration = 300,
}: AdminStaggerListProps) {
  const [visible, setVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
          }
        });
      },
      { threshold: 0.1 }
    );

    const node = containerRef.current;
    if (node) {
      observer.observe(node);
    }

    return () => {
      if (node) {
        observer.unobserve(node);
      }
    };
  }, []);

  return (
    <div ref={containerRef} className={cn('space-y-2', className)}>
      {children.map((child, index) => (
        <div
          key={index}
          className={cn(
            'transition-all duration-300',
            visible
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-4'
          )}
          style={{
            transitionDelay: visible ? `${index * staggerDelay}ms` : '0ms',
            transitionDuration: `${animationDuration}ms`,
          }}
        >
          {child}
        </div>
      ))}
    </div>
  );
}


