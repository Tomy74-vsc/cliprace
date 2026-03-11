import { forwardRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Surface, type SurfaceProps } from './Surface';

/* ── Types ───────────────────────────────────────────────────────────────── */

export interface PanelProps extends Omit<SurfaceProps, 'as'> {
  /** Panel title (rendered in header). */
  title?: string;
  /** Description below title. */
  description?: string;
  /** Action slot floated right in header (button / link). */
  action?: ReactNode;
}

/* ── Component ───────────────────────────────────────────────────────────── */

export const Panel = forwardRef<HTMLDivElement, PanelProps>(
  ({ title, description, action, children, className, ...surfaceProps }, ref) => {
    const hasHeader = title || description || action;

    return (
      <Surface ref={ref} className={cn('overflow-hidden', className)} {...surfaceProps}>
        {hasHeader && (
          <div className="flex items-start justify-between gap-4 border-b border-[var(--border-1)] px-6 pb-4 pt-5">
            <div className="min-w-0">
              {title && (
                <h3 className="text-[15px] font-semibold text-[var(--text-1)] brand-tracking">
                  {title}
                </h3>
              )}
              {description && (
                <p className="mt-0.5 text-[13px] text-[var(--text-3)] leading-relaxed">
                  {description}
                </p>
              )}
            </div>
            {action && <div className="shrink-0">{action}</div>}
          </div>
        )}
        <div className="p-6">{children}</div>
      </Surface>
    );
  },
);

Panel.displayName = 'Panel';

export default Panel;
