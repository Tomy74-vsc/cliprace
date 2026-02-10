'use client';

import { CheckCircle2 } from 'lucide-react';
import { useContestWizard } from '@/store/useContestWizard';

const STEPS = [
  { id: 1, label: 'Type' },
  { id: 2, label: 'Brief' },
  { id: 3, label: 'Prix' },
  { id: 4, label: 'Règles' },
  { id: 5, label: 'Paiement' },
] as const;

export function WizardStepper() {
  const { currentStep } = useContestWizard();

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar py-1">
        {STEPS.map((step, index) => {
          const isCompleted = step.id < currentStep;
          const isCurrent = step.id === currentStep;

          return (
            <div
              key={step.id}
              className="flex-1 min-w-[64px] flex flex-col items-center"
            >
              <div className="flex items-center w-full">
                <div className="flex flex-col items-center flex-none">
                  <div
                    className={[
                      'flex items-center justify-center w-8 h-8 rounded-full border-2 text-xs font-semibold transition-all',
                      isCompleted
                        ? 'bg-emerald-500 border-emerald-500 text-emerald-50 shadow-sm'
                        : isCurrent
                          ? 'bg-primary/10 border-primary text-primary shadow-sm'
                          : 'border-border text-muted-foreground bg-background',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <span>{step.id}</span>
                    )}
                  </div>
                  <span
                    className={[
                      'mt-1 text-[11px] tracking-wide',
                      isCurrent ? 'text-primary font-medium' : 'text-muted-foreground',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {step.label}
                  </span>
                </div>

                {index < STEPS.length - 1 && (
                  <div className="flex-1 h-px mx-2">
                    <div
                      className={[
                        'h-px w-full',
                        step.id < currentStep
                          ? 'bg-primary'
                          : 'bg-muted-foreground/20',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

