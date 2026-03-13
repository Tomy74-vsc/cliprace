'use client';

import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import type { WizardStep } from '../_types';

interface WizardActionsProps {
  currentStep: WizardStep;
  onPrev: () => void;
  onNext: () => void;
  onSubmit: (publish: boolean) => void;
  isSubmitting: boolean;
}

export function WizardActions({
  currentStep,
  onPrev,
  onNext,
  onSubmit,
  isSubmitting,
}: WizardActionsProps) {
  const isLastStep = currentStep === 5;

  return (
    <div className="mt-8 flex items-center justify-between">
      <div>
        {currentStep > 1 && (
          <button
            type="button"
            onClick={onPrev}
            disabled={isSubmitting}
            className="inline-flex items-center gap-1 rounded-[var(--r2)] border border-[var(--border-2)] bg-transparent px-3 py-2 text-sm font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        {!isLastStep ? (
          <button
            type="button"
            onClick={onNext}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-[var(--r2)] bg-[var(--cta-bg)] px-4 py-2 text-sm font-medium text-[var(--cta-fg)] shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            Continue
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onSubmit(false)}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-[var(--r2)] border border-[var(--border-2)] bg-transparent px-3 py-2 text-sm font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Save as draft
            </button>
            <button
              type="button"
              onClick={() => onSubmit(true)}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-[var(--r2)] bg-[var(--cta-bg)] px-4 py-2 text-sm font-medium text-[var(--cta-fg)] shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Publish contest
            </button>
          </>
        )}
      </div>
    </div>
  );
}

