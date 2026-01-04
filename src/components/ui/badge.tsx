// Source: Design System - Badges
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-muted text-foreground",
        success: "bg-success/15 text-success",
        warning: "bg-warning/15 text-warning",
        danger: "bg-danger/15 text-danger",
        info: "bg-info/15 text-info",
        secondary: "bg-secondary/40 text-secondary-foreground",
        outline: "border border-border bg-transparent text-foreground",

        pending: "bg-muted text-muted-foreground",
        approved: "bg-success/15 text-success",
        rejected: "bg-danger/15 text-danger",
        won: "bg-warning/15 text-warning",

        tiktok: "bg-black text-white",
        instagram: "bg-gradient-to-r from-purple-500 to-pink-500 text-white",
        youtube: "bg-red-600 text-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };

