import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: 'default' | 'error';
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type = "text", variant = "default", ...props }, ref) => {
	return (
		<input
			type={type}
			className={cn(
				"flex h-12 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base ring-offset-background placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:border-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 transition-all duration-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus-visible:border-indigo-400",
				variant === "error" && "border-red-500 focus-visible:ring-red-500 focus-visible:border-red-500 dark:border-red-500",
				className
			)}
			ref={ref}
			{...props}
		/>
	);
});
Input.displayName = "Input";


