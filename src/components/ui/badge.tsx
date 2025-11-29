// Source: Design System — Badges (§32, §1278)
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        // Palette de base (statuts génériques)
        default: 'bg-muted text-foreground',
        success: 'bg-emerald-500/15 text-emerald-500',
        warning: 'bg-amber-500/15 text-amber-600',
        danger: 'bg-rose-500/15 text-rose-600',
        info: 'bg-accent/15 text-accent',
        secondary: 'bg-secondary/40 text-secondary-foreground',
        outline: 'border border-border bg-transparent text-foreground',
        // Statuts soumissions
        pending: 'bg-muted text-muted-foreground',
        approved: 'bg-emerald-500/15 text-emerald-500',
        rejected: 'bg-rose-500/15 text-rose-600',
        won: 'bg-amber-500/15 text-amber-600',
        // Plateformes
        tiktok: 'bg-black text-white',
        instagram: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white',
        youtube: 'bg-red-600 text-white',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };

