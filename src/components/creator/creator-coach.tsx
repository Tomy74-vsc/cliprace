import type { ReactNode } from "react";
import { Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

interface CreatorCoachProps {
  title: string;
  description: string;
  accent?: string;
  icon?: ReactNode;
  className?: string;
  action?: ReactNode;
}

export function CreatorCoach({
  title,
  description,
  accent,
  icon,
  className,
  action,
}: CreatorCoachProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl border border-border bg-card/70 px-4 py-3 shadow-sm cliprace-surface",
        "backdrop-blur-sm",
        className,
      )}
    >
      <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
        {icon ?? <Lightbulb className="h-4 w-4" />}
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          {accent && (
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {accent}
            </span>
          )}
        </div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
