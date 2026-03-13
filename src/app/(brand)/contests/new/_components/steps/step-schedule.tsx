'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { WizardFormData } from '../../_types';
import { stepScheduleSchema } from '../../_types';

type Props = {
  data: WizardFormData;
  onChange: (patch: Partial<WizardFormData>) => void;
};

type ScheduleFormValues = {
  startAt: Date;
  endAt: Date;
};

function toLocalInputValue(date: Date | null) {
  if (!date) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function fromLocalInputValue(value: string): Date {
  return new Date(value);
}

function diffDays(start: Date | null, end: Date | null): number | null {
  if (!start || !end) return null;
  const ms = end.getTime() - start.getTime();
  if (ms <= 0) return null;
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export function StepSchedule({ data, onChange }: Props) {
  const now = new Date();
  const initialStart = data.startAt ?? now;
  const initialEnd = data.endAt ?? new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ScheduleFormValues>({
    resolver: zodResolver(stepScheduleSchema),
    defaultValues: {
      startAt: initialStart,
      endAt: initialEnd,
    },
  });

  const values = watch();

  useEffect(() => {
    onChange({
      startAt: values.startAt ?? null,
      endAt: values.endAt ?? null,
    });
  }, [values, onChange]);

  const startInputMin = toLocalInputValue(now);
  const endInputMin = toLocalInputValue(
    new Date((values.startAt ?? now).getTime() + 24 * 60 * 60 * 1000),
  );

  const durationDays = diffDays(values.startAt ?? null, values.endAt ?? null);

  return (
    <form
      onSubmit={handleSubmit(() => {})}
      className="space-y-6"
      noValidate
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-[var(--text-2)]">
            Start date
          </label>
          <input
            type="datetime-local"
            min={startInputMin}
            defaultValue={toLocalInputValue(initialStart)}
            onChange={(e) =>
              setValue('startAt', fromLocalInputValue(e.target.value), {
                shouldValidate: true,
                shouldDirty: true,
              })
            }
            className="mt-1 w-full rounded-[var(--r2)] border border-[var(--border-1)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-1)] outline-none focus-visible:border-[var(--accent)]"
          />
          {errors.startAt && (
            <p className="mt-1 text-[12px] text-[var(--danger)]">
              {errors.startAt.message}
            </p>
          )}
        </div>

        <div>
          <label className="text-xs font-medium text-[var(--text-2)]">
            End date
          </label>
          <input
            type="datetime-local"
            min={endInputMin}
            defaultValue={toLocalInputValue(initialEnd)}
            onChange={(e) =>
              setValue('endAt', fromLocalInputValue(e.target.value), {
                shouldValidate: true,
                shouldDirty: true,
              })
            }
            className="mt-1 w-full rounded-[var(--r2)] border border-[var(--border-1)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-1)] outline-none focus-visible:border-[var(--accent)]"
          />
          {errors.endAt && (
            <p className="mt-1 text-[12px] text-[var(--danger)]">
              {errors.endAt.message}
            </p>
          )}
        </div>
      </div>

      <p className="text-xs text-[var(--text-2)]">
        {durationDays
          ? `Contest runs for ${durationDays} day${durationDays > 1 ? 's' : ''}.`
          : 'Set start and end dates to compute contest duration.'}
      </p>
    </form>
  );
}

