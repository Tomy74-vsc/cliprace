'use client';

import { cn } from '@/lib/utils';

type AdminShimmerSkeletonProps = {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  lines?: number;
};

/**
 * Skeleton avec effet shimmer animé
 * Plus élégant que les skeletons basiques
 */
export function AdminShimmerSkeleton({
  className,
  variant = 'rounded',
  width,
  height,
  lines,
}: AdminShimmerSkeletonProps) {
  const baseClasses = cn(
    'relative overflow-hidden',
    'bg-muted/40',
    'before:absolute before:inset-0',
    'before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent',
    'before:animate-shimmer',
    variant === 'rounded' && 'rounded-2xl',
    variant === 'circular' && 'rounded-full',
    variant === 'rectangular' && 'rounded-none',
    className
  );

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  if (lines && lines > 1) {
    return (
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(
              baseClasses,
              i === 0 && 'w-3/4',
              i === lines - 1 && 'w-1/2',
              'h-4'
            )}
            style={i === 0 || i === lines - 1 ? undefined : style}
          />
        ))}
      </div>
    );
  }

  return <div className={baseClasses} style={style} />;
}

// Ajouter l'animation shimmer dans le CSS global ou via Tailwind
// @keyframes shimmer {
//   0% { transform: translateX(-100%); }
//   100% { transform: translateX(100%); }
// }


