/**
 * EmptyState — Centered placeholder for empty lists/tables.
 * Server component.
 */
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Surface } from './Surface';

/* ── Types ── */

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

export interface EmptyStateProps {
  title: string;
  description?: string;
  /** CTA button config or custom ReactNode. */
  action?: EmptyStateAction | ReactNode;
  /** Icon slot (e.g. lucide icon). */
  icon?: ReactNode;
  /** Use track-pattern Surface background. */
  variant?: 'default' | 'track';
  className?: string;
}

/* ── Component ── */

export function EmptyState({
  title,
  description,
  action,
  icon,
  variant = 'default',
  className,
}: EmptyStateProps) {
  const content = (
    <div className="brand-scope flex flex-col items-center justify-center gap-4 py-12 px-6 text-center">
      {icon && (
        <div className="text-[var(--text-3)] [&_svg]:h-10 [&_svg]:w-10">
          {icon}
        </div>
      )}
      <div className="space-y-1.5">
        <h3 className="text-[16px] font-semibold text-[var(--text-1)]">
          {title}
        </h3>
        {description && (
          <p className="text-[14px] text-[var(--text-3)] max-w-sm mx-auto leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {action && (
        <div className="mt-2">
          {isActionConfig(action) ? (
            <button
              type="button"
              onClick={action.onClick}
              className={cn(
                'inline-flex items-center justify-center rounded-[var(--r2)] px-5 py-2.5',
                'bg-[var(--cta-bg)] text-[var(--cta-fg)]',
                'text-sm font-semibold',
                'hover:bg-white/90 transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50',
                'focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-void)]',
              )}
            >
              {action.label}
            </button>
          ) : (
            action
          )}
        </div>
      )}
    </div>
  );

  if (variant === 'track') {
    return (
      <Surface variant="track" className={className}>
        {content}
      </Surface>
    );
  }

  return <div className={className}>{content}</div>;
}

function isActionConfig(
  action: EmptyStateAction | ReactNode,
): action is EmptyStateAction {
  return (
    typeof action === 'object' &&
    action !== null &&
    'label' in action &&
    'onClick' in action
  );
}

export default EmptyState;
