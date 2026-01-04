import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Trophy, Search, Inbox, Video, AlertCircle } from "lucide-react";

type EmptyStateAction =
  | {
      label: string;
      href: string;
      onClick?: never;
      variant?: 'primary' | 'secondary' | 'ghost';
    }
  | {
      label: string;
      href?: never;
      onClick: () => void;
      variant?: 'primary' | 'secondary' | 'ghost';
    };

type EmptyStateType =
  | "default"
  | "discover"
  | "submissions"
  | "wallet"
  | "notifications"
  | "contest"
  | "error";

interface EmptyStateProps {
  type?: EmptyStateType;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  className?: string;
  children?: ReactNode;
}

const iconConfig: Record<EmptyStateType, { icon: ReactNode; gradient: string }> = {
  default: {
    icon: <Video className="h-12 w-12" />,
    gradient: "from-primary/15 via-accent/10 to-transparent",
  },
  discover: {
    icon: <Search className="h-12 w-12" />,
    gradient: "from-blue-400/20 via-sky-400/10 to-transparent",
  },
  submissions: {
    icon: <Video className="h-12 w-12" />,
    gradient: "from-purple-400/20 via-indigo-400/10 to-transparent",
  },
  wallet: {
    icon: <Trophy className="h-12 w-12" />,
    gradient: "from-amber-400/20 via-orange-400/10 to-transparent",
  },
  notifications: {
    icon: <Inbox className="h-12 w-12" />,
    gradient: "from-emerald-400/20 via-teal-400/10 to-transparent",
  },
  contest: {
    icon: <Trophy className="h-12 w-12" />,
    gradient: "from-pink-400/20 via-rose-400/10 to-transparent",
  },
  error: {
    icon: <AlertCircle className="h-12 w-12" />,
    gradient: "from-red-400/20 via-rose-400/10 to-transparent",
  },
};

export function EmptyState({
  type = "default",
  title,
  description,
  action,
  secondaryAction,
  className,
  children,
}: EmptyStateProps) {
  const config = iconConfig[type];

  const renderAction = (config?: EmptyStateAction) => {
    if (!config) return null;
    if (config.href) {
      return (
        <Button asChild variant={config.variant ?? 'primary'}>
          <a href={config.href}>{config.label}</a>
        </Button>
      );
    }
    return (
      <Button onClick={config.onClick} variant={config.variant ?? 'primary'}>
        {config.label}
      </Button>
    );
  };

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-gradient-to-br",
        config.gradient,
        "px-6 py-10 text-center shadow-card overflow-hidden",
        className,
      )}
    >
      <div className="relative z-10 flex items-center justify-center mb-2">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-primary/15 blur-2xl" />
          <div className="relative text-primary/70 dark:text-primary/50">{config.icon}</div>
        </div>
      </div>
      <div className="relative z-10 space-y-2">
        <div className="text-lg font-semibold text-foreground">{title}</div>
        {description && (
          <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            {description}
          </p>
        )}
        {children}
      </div>
      {(action || secondaryAction) && (
        <div className="relative z-10 mt-3 flex flex-wrap items-center justify-center gap-2">
          {renderAction(action)}
          {renderAction(secondaryAction)}
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 opacity-5 dark:opacity-10">
        <svg
          className="w-full h-full"
          viewBox="0 0 400 400"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="60" cy="80" r="2" fill="currentColor" />
          <circle cx="340" cy="120" r="2" fill="currentColor" />
          <circle cx="120" cy="320" r="2" fill="currentColor" />
          <circle cx="280" cy="280" r="1.5" fill="currentColor" />
          <circle cx="200" cy="160" r="1" fill="currentColor" />
        </svg>
      </div>
    </div>
  );
}
