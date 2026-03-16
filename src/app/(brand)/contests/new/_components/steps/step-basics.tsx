'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { WizardFormData, Platform } from '../../_types';
import { stepBasicsSchema } from '../../_types';
import { cn } from '@/lib/utils';

type Props = {
  data: WizardFormData;
  onChange: (patch: Partial<WizardFormData>) => void;
};

type BasicsFormValues = {
  title: string;
  briefMd: string;
  networks: Platform[];
};

const PLATFORMS: { id: Platform; label: string }[] = [
  { id: 'tiktok', label: 'TikTok' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'twitter', label: 'Twitter' },
];

export function StepBasics({ data, onChange }: Props) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<BasicsFormValues>({
    resolver: zodResolver(stepBasicsSchema),
    defaultValues: {
      title: data.title,
      briefMd: data.briefMd,
      networks: data.networks,
    },
  });

  const values = watch();

  useEffect(() => {
    onChange(values);
  }, [values, onChange]);

  const togglePlatform = (platform: Platform) => {
    const current = values.networks ?? [];
    const next = current.includes(platform)
      ? current.filter((p) => p !== platform)
      : [...current, platform];
    setValue('networks', next, { shouldValidate: true, shouldDirty: true });
  };

  return (
    <form
      onSubmit={handleSubmit(() => {})}
      className="space-y-6"
      noValidate
    >
      <div>
        <label htmlFor="contest-title" className="text-xs font-medium text-[var(--text-2)]">
          Contest title
        </label>
        <input
          type="text"
          placeholder="Summer UGC Challenge 2025"
          id="contest-title"
          {...register('title')}
          className="mt-1 w-full rounded-[var(--r2)] border border-[var(--border-1)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-1)] outline-none focus-visible:border-[var(--accent)]"
        />
        {errors.title && (
          <p className="mt-1 text-[12px] text-[var(--danger)]">
            {errors.title.message}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="contest-brief" className="text-xs font-medium text-[var(--text-2)]">
          Brief
        </label>
        <textarea
          rows={6}
          placeholder="Describe what creators should make..."
          id="contest-brief"
          {...register('briefMd')}
          className="mt-1 w-full resize-none rounded-[var(--r2)] border border-[var(--border-1)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-1)] outline-none focus-visible:border-[var(--accent)]"
        />
        {errors.briefMd && (
          <p className="mt-1 text-[12px] text-[var(--danger)]">
            {errors.briefMd.message}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="platforms" className="text-xs font-medium text-[var(--text-2)]">
          Platforms
        </label>
        <div id="platforms" className="mt-2 flex flex-wrap gap-2">
          {PLATFORMS.map((platform) => {
            const active = values.networks?.includes(platform.id);
            return (
              <button
                key={platform.id}
                type="button"
                onClick={() => togglePlatform(platform.id)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-[var(--r2)] border px-3 py-1.5 text-xs font-medium transition-colors',
                  active
                    ? 'border-[var(--accent-edge)] bg-[var(--accent-soft)] text-[var(--accent)]'
                    : 'border-[var(--border-1)] bg-[var(--surface-2)] text-[var(--text-3)]',
                )}
              >
                {platform.label}
              </button>
            );
          })}
        </div>
        {errors.networks && (
          <p className="mt-1 text-[12px] text-[var(--danger)]">
            {errors.networks.message}
          </p>
        )}
      </div>
    </form>
  );
}

