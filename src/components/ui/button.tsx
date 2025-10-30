"use client";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import * as React from "react";

const buttonVariants = cva(
	"inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-60 active:scale-95",
	{
		variants: {
			variant: {
				default:
					"bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-500 hover:to-violet-500 hover:shadow-xl hover:shadow-indigo-500/30 focus-visible:ring-2 focus-visible:ring-indigo-500 dark:from-violet-500 dark:to-indigo-500 dark:hover:from-violet-400 dark:hover:to-indigo-400",
				outline:
					"border-2 border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50 hover:border-indigo-300 hover:text-indigo-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:hover:border-indigo-600 dark:hover:text-indigo-300",
				ghost: "hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100",
				destructive:
					"bg-red-600 text-white shadow-lg shadow-red-500/25 hover:bg-red-500 hover:shadow-xl hover:shadow-red-500/30 focus-visible:ring-2 focus-visible:ring-red-500 dark:bg-red-700 dark:hover:bg-red-600",
			},
			size: {
				sm: "h-9 px-4 text-xs",
				md: "h-11 px-6 text-sm",
				lg: "h-12 px-8 text-base",
			},
		},
		defaultVariants: { variant: "default", size: "md" },
	}
);

export interface ButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof buttonVariants> {
		asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant, size, asChild, ...props }, ref) => {
		const Comp = asChild ? Slot : "button";
		return (
			<Comp
				className={cn(buttonVariants({ variant, size }), className)}
				ref={ref}
				{...props}
			/>
		);
	}
);
Button.displayName = "Button";

export { buttonVariants };


