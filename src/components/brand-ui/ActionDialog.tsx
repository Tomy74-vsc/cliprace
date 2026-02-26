'use client';

/**
 * ActionDialog — Finance-grade confirm dialog for destructive/important actions.
 * Client component (framer-motion spring animation + Radix Dialog).
 *
 * Features:
 * - Spring entrance (scale 0.95→1, opacity 0→1)
 * - Variants: default (neutral) | danger (red accent)
 * - Backdrop blur with Ink darkness
 * - Focus trap, escape close, keyboard accessible
 * - Respects prefers-reduced-motion
 */
import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { useBrandPortalContainer } from './use-brand-portal';

/* ── Motion config ── */
const springConfig = { stiffness: 300, damping: 30 };
const reducedMotion = { duration: 0.01 };

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const contentVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 8 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring' as const, ...springConfig },
  },
};

/* ── CVA ── */
const dialogVariants = cva('', {
  variants: {
    intent: {
      default: '',
      danger: '',
    },
  },
  defaultVariants: {
    intent: 'default',
  },
});

const confirmButtonVariants = cva(
  'inline-flex items-center justify-center rounded-[var(--r2)] px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-void)] disabled:opacity-50',
  {
    variants: {
      intent: {
        default:
          'bg-[var(--cta-bg)] text-[var(--cta-fg)] hover:bg-white/90 focus-visible:ring-white/50',
        danger:
          'bg-[var(--brand-danger)] text-white hover:bg-red-600 focus-visible:ring-[var(--brand-danger)]',
      },
    },
    defaultVariants: {
      intent: 'default',
    },
  },
);

export interface ActionDialogProps extends VariantProps<typeof dialogVariants> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  /** Disable confirm button (e.g. during async action) */
  loading?: boolean;
  children?: React.ReactNode;
}

export function ActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  onConfirm,
  loading = false,
  intent = 'default',
  children,
}: ActionDialogProps) {
  const portalContainer = useBrandPortalContainer();

  // Detect reduced motion preference
  const prefersReduced =
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;
  const transition = prefersReduced ? reducedMotion : undefined;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount container={portalContainer}>
            {/* ── Overlay ── */}
            <DialogPrimitive.Overlay asChild>
              <motion.div
                className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                variants={overlayVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
                transition={transition ?? { duration: 0.15 }}
              />
            </DialogPrimitive.Overlay>

            {/* ── Content ── */}
            <DialogPrimitive.Content asChild>
              <motion.div
                className={cn(
                  'fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2',
                  'rounded-[var(--r4)] border border-[var(--border-1)]',
                  'bg-[var(--surface-1)] p-6',
                  'shadow-[var(--shadow-brand-2)]',
                  'focus:outline-none',
                  dialogVariants({ intent }),
                )}
                variants={contentVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
                transition={transition}
              >
                {/* Close button */}
                <DialogPrimitive.Close
                  className={cn(
                    'absolute right-4 top-4 rounded-lg p-1',
                    'text-[var(--text-3)] hover:text-[var(--text-1)]',
                    'transition-colors focus-visible:outline-none',
                    'focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)]',
                  )}
                  aria-label="Fermer"
                >
                  <X className="h-4 w-4" strokeWidth={1.5} />
                </DialogPrimitive.Close>

                {/* Title */}
                <DialogPrimitive.Title className="text-lg font-semibold text-[var(--text-1)] brand-tracking pr-8">
                  {title}
                </DialogPrimitive.Title>

                {/* Description */}
                {description && (
                  <DialogPrimitive.Description className="mt-2 text-sm text-[var(--text-2)] leading-relaxed">
                    {description}
                  </DialogPrimitive.Description>
                )}

                {/* Custom content */}
                {children && <div className="mt-4">{children}</div>}

                {/* Actions */}
                <div className="mt-6 flex items-center justify-end gap-3">
                  <DialogPrimitive.Close
                    className={cn(
                      'rounded-[var(--r2)] px-4 py-2.5 text-sm font-medium',
                      'text-[var(--text-2)] hover:text-[var(--text-1)]',
                      'border border-[var(--border-1)] hover:border-[var(--border-2)]',
                      'transition-colors focus-visible:outline-none',
                      'focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-1)]',
                    )}
                  >
                    {cancelLabel}
                  </DialogPrimitive.Close>

                  <button
                    type="button"
                    onClick={onConfirm}
                    disabled={loading}
                    className={confirmButtonVariants({ intent })}
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <svg
                          className="h-4 w-4 animate-spin"
                          viewBox="0 0 24 24"
                          fill="none"
                          aria-hidden="true"
                        >
                          <circle
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="opacity-25"
                          />
                          <path
                            d="M4 12a8 8 0 018-8"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            className="opacity-75"
                          />
                        </svg>
                        {confirmLabel}
                      </span>
                    ) : (
                      confirmLabel
                    )}
                  </button>
                </div>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
