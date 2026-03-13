'use client';

import { Check } from 'lucide-react';
import type { WizardStep } from '../_types';
import { WIZARD_STEPS } from '../_types';
import { cn } from '@/lib/utils';

interface WizardProgressProps {
  currentStep: WizardStep;
  steps: typeof WIZARD_STEPS;
}

export function WizardProgress({ currentStep, steps }: WizardProgressProps) {
  return (
    <div className="flex w-full items-center gap-0">
      {steps.map((step, index) => {
        const stepNumber = step.step;
        const isCompleted = stepNumber < currentStep;
        const isActive = stepNumber === currentStep;
        const isLast = index === steps.length - 1;

        return (
          <div key={step.step} className="flex flex-1 items-center gap-2">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border text-xs font-medium transition-colors duration-150',
                  isCompleted &&
                    'border-transparent bg-[var(--accent)] text-[var(--cta-fg)]',
                  isActive &&
                    'border-2 border-[var(--accent)] bg-[var(--surface-2)] text-[var(--accent)]',
                  !isCompleted &&
                    !isActive &&
                    'border-[var(--border-2)] bg-[var(--surface-2)] text-[var(--text-3)]',
                )}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : stepNumber}
              </div>
              <div
                className={cn(
                  'mt-1 text-[10px] uppercase tracking-wide',
                  isActive
                    ? 'font-medium text-[var(--text-1)]'
                    : 'text-[var(--text-3)]',
                )}
              >
                {step.label}
              </div>
            </div>

            {!isLast && (
              <div
                className={cn(
                  'h-px flex-1',
                  stepNumber < currentStep
                    ? 'bg-[var(--accent)]'
                    : 'bg-[var(--border-1)]',
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

