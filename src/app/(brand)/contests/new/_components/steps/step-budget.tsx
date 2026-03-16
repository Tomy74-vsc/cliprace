'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { WizardFormData } from '../../_types';
import { stepBudgetSchema } from '../../_types';
import { Surface } from '@/components/brand-ui/Surface';
import { cn } from '@/lib/utils';

type Props = {
  data: WizardFormData;
  onChange: (patch: Partial<WizardFormData>) => void;
};

type BudgetFormValues = {
  budgetCents: number;
  prizePoolCents: number;
  currency: 'EUR' | 'USD';
  maxWinners: number;
};

export function StepBudget({ data, onChange }: Props) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<BudgetFormValues>({
    resolver: zodResolver(stepBudgetSchema),
    defaultValues: {
      budgetCents: data.budgetCents,
      prizePoolCents: data.prizePoolCents,
      currency: data.currency,
      maxWinners: data.maxWinners,
    },
  });

  const values = watch();

  useEffect(() => {
    onChange(values);
  }, [values, onChange]);

  const setCurrency = (currency: 'EUR' | 'USD') => {
    setValue('currency', currency, { shouldValidate: true, shouldDirty: true });
  };

  const budgetAmount = values.budgetCents / 100 || 0;
  const prizeAmount = values.prizePoolCents / 100 || 0;
  const platformFee = budgetAmount * 0.2;

  return (
    <form
      onSubmit={handleSubmit(() => {})}
      className="space-y-6"
      noValidate
    >
      <div>
        <label htmlFor="currency" className="text-xs font-medium text-[var(--text-2)]">
          Currency
        </label>
        <div id="currency" className="mt-2 flex gap-2">
          {(['EUR', 'USD'] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCurrency(c)}
              className={cn(
                'inline-flex items-center rounded-[var(--r2)] border px-3 py-1.5 text-xs font-medium transition-colors',
                values.currency === c
                  ? 'border-[var(--accent-edge)] bg-[var(--accent-soft)] text-[var(--accent)]'
                  : 'border-[var(--border-1)] bg-[var(--surface-2)] text-[var(--text-3)]',
              )}
            >
              {c}
            </button>
          ))}
        </div>
        {errors.currency && (
          <p className="mt-1 text-[12px] text-[var(--danger)]">
            {errors.currency.message}
          </p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="total-budget" className="text-xs font-medium text-[var(--text-2)]">
            Total budget ({values.currency})
          </label>
          <input
            type="number"
            min={0}
            step="1"
            placeholder="500"
            id="total-budget"
            {...register('budgetCents', {
              setValueAs: (v) => (v === '' ? 0 : Number(v) * 100),
            })}
            className="mt-1 w-full rounded-[var(--r2)] border border-[var(--border-1)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-1)] outline-none focus-visible:border-[var(--accent)]"
          />
          <p className="mt-1 text-[11px] text-[var(--text-3)]">
            Total amount you&apos;ll spend on this campaign.
          </p>
          {errors.budgetCents && (
            <p className="mt-1 text-[12px] text-[var(--danger)]">
              {errors.budgetCents.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="prize-pool" className="text-xs font-medium text-[var(--text-2)]">
            Prize pool ({values.currency})
          </label>
          <input
            type="number"
            min={0}
            step="1"
            placeholder="250"
            id="prize-pool"
            {...register('prizePoolCents', {
              setValueAs: (v) => (v === '' ? 0 : Number(v) * 100),
            })}
            className="mt-1 w-full rounded-[var(--r2)] border border-[var(--border-1)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-1)] outline-none focus-visible:border-[var(--accent)]"
          />
          <p className="mt-1 text-[11px] text-[var(--text-3)]">
            Total prizes for winning creators (≤ budget).
          </p>
          {errors.prizePoolCents && (
            <p className="mt-1 text-[12px] text-[var(--danger)]">
              {errors.prizePoolCents.message}
            </p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="max-winners" className="text-xs font-medium text-[var(--text-2)]">
          Max winners
        </label>
        <input
          type="number"
          min={1}
          max={100}
          step="1"
          id="max-winners"
          {...register('maxWinners', {
            setValueAs: (v) => (v === '' ? 1 : Number(v)),
          })}
          className="mt-1 w-full max-w-[200px] rounded-[var(--r2)] border border-[var(--border-1)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-1)] outline-none focus-visible:border-[var(--accent)]"
        />
        <p className="mt-1 text-[11px] text-[var(--text-3)]">
          Number of creators who will receive prizes.
        </p>
        {errors.maxWinners && (
          <p className="mt-1 text-[12px] text-[var(--danger)]">
            {errors.maxWinners.message}
          </p>
        )}
      </div>

      <Surface className="mt-2 rounded-[var(--r3)] bg-[var(--surface-2)] p-4">
        <p className="text-xs text-[var(--text-2)]">
          Budget:{' '}
          <span className="font-medium text-[var(--text-1)]">
            {budgetAmount.toLocaleString(undefined, {
              style: 'currency',
              currency: values.currency,
              maximumFractionDigits: 0,
            })}
          </span>{' '}
          {' | '}
          Prize pool:{' '}
          <span className="font-medium text-[var(--text-1)]">
            {prizeAmount.toLocaleString(undefined, {
              style: 'currency',
              currency: values.currency,
              maximumFractionDigits: 0,
            })}
          </span>{' '}
          {' | '}
          Platform fee:{' '}
          <span className="font-medium text-[var(--text-1)]">
            {platformFee.toLocaleString(undefined, {
              style: 'currency',
              currency: values.currency,
              maximumFractionDigits: 0,
            })}
          </span>{' '}
          (20%)
        </p>
      </Surface>
    </form>
  );
}

