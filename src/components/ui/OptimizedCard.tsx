/**
 * Composant Card optimisé avec animations et effets visuels
 */

import { forwardRef, useState, useCallback } from 'react';
import { useAnimation, AnimationConfig } from '@/lib/animations';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'feature' | 'stat' | 'product' | 'enterprise';
  hover?: boolean;
  animation?: Partial<AnimationConfig>;
  glass?: boolean;
  gradient?: boolean;
  children: React.ReactNode;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = 'default',
      hover = true,
      animation,
      glass = false,
      gradient = false,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const [isHovered, setIsHovered] = useState(false);
    const { isAnimating, animationClass, startAnimation } = useAnimation(animation);
    
    const handleMouseEnter = useCallback(() => {
      setIsHovered(true);
      if (animation) {
        startAnimation();
      }
    }, [animation, startAnimation]);
    
    const handleMouseLeave = useCallback(() => {
      setIsHovered(false);
    }, []);
    
    const baseClasses = 'card relative overflow-hidden transition-all duration-300';
    const variantClasses = {
      default: 'bg-surface border-border',
      feature: 'card-feature',
      stat: 'stat-bubble',
      product: 'bg-[#15131d] border-primary/40 text-white',
      enterprise: 'glass border-white/20 text-white',
    };
    
    const classes = [
      baseClasses,
      variantClasses[variant],
      glass && 'glass',
      gradient && 'bg-gradient-to-br from-primary/10 to-secondary/10',
      hover && 'hover:-translate-y-1 hover:shadow-xl',
      isHovered && 'scale-[1.02]',
      isAnimating && animationClass,
      className,
    ].filter(Boolean).join(' ');
    
    return (
      <div
        ref={ref}
        className={classes}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        {/* Gradient overlay pour les cartes feature */}
        {variant === 'feature' && (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        )}
        
        {/* Glow effect pour les cartes product */}
        {variant === 'product' && (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        )}
        
        {/* Content */}
        <div className="relative z-10">
          {children}
        </div>
        
        {/* Animated border pour les cartes enterprise */}
        {variant === 'enterprise' && (
          <div className="absolute inset-0 rounded-xl border border-white/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        )}
      </div>
    );
  }
);

Card.displayName = 'Card';

// Composants spécialisés
export const FeatureCard = forwardRef<HTMLDivElement, Omit<CardProps, 'variant'>>(
  (props, ref) => <Card {...props} variant="feature" ref={ref} />
);

export const StatCard = forwardRef<HTMLDivElement, Omit<CardProps, 'variant'>>(
  (props, ref) => <Card {...props} variant="stat" ref={ref} />
);

export const ProductCard = forwardRef<HTMLDivElement, Omit<CardProps, 'variant'>>(
  (props, ref) => <Card {...props} variant="product" ref={ref} />
);

export const EnterpriseCard = forwardRef<HTMLDivElement, Omit<CardProps, 'variant'>>(
  (props, ref) => <Card {...props} variant="enterprise" ref={ref} />
);

FeatureCard.displayName = 'FeatureCard';
StatCard.displayName = 'StatCard';
ProductCard.displayName = 'ProductCard';
EnterpriseCard.displayName = 'EnterpriseCard';

export { Card };
