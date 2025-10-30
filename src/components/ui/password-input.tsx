"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "./input";
import { cn } from "@/lib/utils";

interface PasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  error?: boolean;
  required?: boolean;
  id?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
}

export function PasswordInput({
  value,
  onChange,
  placeholder = "••••••••",
  className,
  error = false,
  required = false,
  id,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="relative">
      <Input
        id={id}
        type={showPassword ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "pr-10",
          error && "border-red-500 focus-visible:ring-red-500",
          className
        )}
        required={required}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
      />
      <button
        type="button"
        onClick={togglePasswordVisibility}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 z-10 transition-colors duration-200"
        aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        aria-pressed={showPassword}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            togglePasswordVisibility();
          }
        }}
      >
        {showPassword ? (
          <EyeOff className="h-4 w-4" />
        ) : (
          <Eye className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
