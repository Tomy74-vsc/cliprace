import { cn } from '@/lib/utils';

export type StepState = 'completed' | 'current' | 'upcoming';

export interface ProgressStep {
  title: string;
  description?: string;
  state: StepState;
}

export function ProgressSteps({ steps, className }: { steps: ProgressStep[]; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-card', className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Progression</p>
        <div className="h-1.5 w-24 rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{
              width: `${(steps.filter((s) => s.state === 'completed').length / steps.length) * 100}%`,
            }}
          />
        </div>
      </div>
      <div className="space-y-3">
        {steps.map((step, idx) => {
          const state = step.state;
          return (
            <div key={step.title} className="flex items-start gap-3">
              <div
                className={cn(
                  'mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold',
                  state === 'completed' && 'bg-primary text-primary-foreground border-primary',
                  state === 'current' && 'bg-primary/10 text-primary border-primary/40',
                  state === 'upcoming' && 'bg-muted text-muted-foreground border-border'
                )}
              >
                {idx + 1}
              </div>
              <div className="flex-1 space-y-0.5">
                <p className="text-sm font-semibold">{step.title}</p>
                {step.description && <p className="text-xs text-muted-foreground">{step.description}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
