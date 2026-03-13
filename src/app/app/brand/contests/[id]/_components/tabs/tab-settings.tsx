'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Panel, BrandInput } from '@/components/brand-ui';
import type { ContestDetail } from '../../_types';
import { useCsrfToken } from '@/hooks/use-csrf-token';

const updateContestSchema = z.object({
  title: z.string().min(3).max(120),
  briefMd: z.string().max(5000).optional().nullable(),
  endAt: z.string(),
  maxWinners: z.coerce.number().int().min(1).max(100),
  networks: z.string().optional(),
});

type SettingsFormValues = z.infer<typeof updateContestSchema>;

interface TabSettingsProps {
  contest: ContestDetail;
}

export function TabSettings({ contest }: TabSettingsProps) {
  const router = useRouter();
  const csrfToken = useCsrfToken();
  const [saving, setSaving] = useState(false);

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(updateContestSchema),
    defaultValues: {
      title: contest.title,
      briefMd: contest.briefMd ?? '',
      endAt: contest.endAt.slice(0, 10),
      maxWinners: contest.maxWinners || 1,
      networks: contest.networks.join(', '),
    },
  });

  const onSubmit = async (values: SettingsFormValues) => {
    if (!csrfToken) {
      toast.error('Missing CSRF token. Please reload the page.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: values.title,
        briefMd: values.briefMd ?? '',
        endAt: new Date(values.endAt).toISOString(),
        maxWinners: values.maxWinners,
        networks: (values.networks ?? '')
          .split(',')
          .map((n) => n.trim())
          .filter(Boolean),
      };

      const res = await fetch(`/api/brand/contests/${contest.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error ?? 'Unable to update contest settings.');
        return;
      }

      toast.success('Contest settings updated');
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel
      title="Campaign settings"
      description="Edit core information for this campaign. Only draft and paused campaigns can be edited."
    >
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6 max-w-xl"
      >
        <div className="space-y-2">
          <label
            htmlFor="title"
            className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]"
          >
            Title
          </label>
          <BrandInput
            id="title"
            {...form.register('title')}
            placeholder="Campaign title"
          />
          {form.formState.errors.title && (
            <p className="text-[11px] text-[var(--danger)]">
              {form.formState.errors.title.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label
            htmlFor="briefMd"
            className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]"
          >
            Brief (markdown)
          </label>
          <textarea
            id="briefMd"
            {...form.register('briefMd')}
            className="mt-1 h-32 w-full rounded-[var(--r2)] border border-[var(--border-1)] bg-[var(--surface-1)] px-3 py-2 text-[13px] text-[var(--text-1)] placeholder:text-[var(--text-3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            placeholder="Explain the campaign goals, deliverables and brand voice…"
          />
          {form.formState.errors.briefMd && (
            <p className="text-[11px] text-[var(--danger)]">
              {form.formState.errors.briefMd.message}
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label
              htmlFor="endAt"
              className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]"
            >
              End date
            </label>
            <BrandInput
              id="endAt"
              type="date"
              {...form.register('endAt')}
            />
            {form.formState.errors.endAt && (
              <p className="text-[11px] text-[var(--danger)]">
                {form.formState.errors.endAt.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label
              htmlFor="maxWinners"
              className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]"
            >
              Max winners
            </label>
            <BrandInput
              id="maxWinners"
              type="number"
              min={1}
              max={100}
              {...form.register('maxWinners', { valueAsNumber: true })}
            />
            {form.formState.errors.maxWinners && (
              <p className="text-[11px] text-[var(--danger)]">
                {form.formState.errors.maxWinners.message}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="networks"
            className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]"
          >
            Networks
          </label>
          <BrandInput
            id="networks"
            {...form.register('networks')}
            placeholder="e.g. TikTok, Instagram, YouTube"
          />
          <p className="text-[11px] text-[var(--text-3)]">
            Comma-separated list of platforms where this campaign runs.
          </p>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-[var(--r2)] bg-[var(--cta-bg)] px-5 py-2.5 text-sm font-semibold text-[var(--cta-fg)] hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-void)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </Panel>
  );
}

