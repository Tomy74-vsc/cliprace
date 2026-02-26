'use client';

/**
 * BrandDrawer — Mobile drawer for brand UI (vaul wrapper).
 *
 * Features:
 * - Handle bar visible
 * - Title + close button
 * - Escape close
 * - A11y: focus trap, aria-label
 * - Ink Dark tokens
 */
import type { ReactNode } from 'react';
import { Drawer } from 'vaul';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBrandPortalContainer } from './use-brand-portal';

export interface BrandDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Optional description below title */
  description?: string;
  children?: ReactNode;
  /** Additional className on content container */
  className?: string;
}

export function BrandDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: BrandDrawerProps) {
  const portalContainer = useBrandPortalContainer();

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal container={portalContainer}>
        {/* Overlay */}
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />

        {/* Content */}
        <Drawer.Content
          className={cn(
            'fixed inset-x-0 bottom-0 z-50',
            'max-h-[85vh] rounded-t-[var(--r4)]',
            'bg-[var(--surface-1)] border-t border-[var(--border-1)]',
            'shadow-[var(--shadow-brand-2)]',
            'focus:outline-none',
            className,
          )}
          aria-label={title}
        >
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="h-1 w-10 rounded-full bg-[var(--border-2)]" />
          </div>

          {/* Header */}
          <div className="flex items-start justify-between px-6 pb-4">
            <div>
              <Drawer.Title className="text-lg font-semibold text-[var(--text-1)] brand-tracking">
                {title}
              </Drawer.Title>
              {description && (
                <Drawer.Description className="mt-1 text-sm text-[var(--text-2)]">
                  {description}
                </Drawer.Description>
              )}
            </div>

            <Drawer.Close
              className={cn(
                'rounded-lg p-1.5 -mr-1.5 -mt-0.5',
                'text-[var(--text-3)] hover:text-[var(--text-1)]',
                'transition-colors focus-visible:outline-none',
                'focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)]',
              )}
              aria-label="Fermer"
            >
              <X className="h-4 w-4" strokeWidth={1.5} />
            </Drawer.Close>
          </div>

          {/* Body */}
          <div className="overflow-y-auto px-6 pb-8">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
