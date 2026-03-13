import { z } from 'zod';

export type Platform = 'tiktok' | 'instagram' | 'youtube' | 'twitter';

export type WizardStep = 1 | 2 | 3 | 4 | 5;

export interface WizardFormData {
  // Step 1 — Basics
  title: string;
  briefMd: string;
  networks: Platform[];

  // Step 2 — Budget
  budgetCents: number;
  prizePoolCents: number;
  currency: 'EUR' | 'USD';
  maxWinners: number;

  // Step 3 — Schedule
  startAt: Date | null;
  endAt: Date | null;

  // Step 4 — Cover
  coverUrl: string | null;
  coverFile: File | null; // client-only, not sent to API

  // Step 5 — Review (no extra fields)
}

export const WIZARD_STEPS: { step: WizardStep; label: string; description: string }[] = [
  { step: 1, label: 'Basics', description: 'Title, brief, platforms' },
  { step: 2, label: 'Budget', description: 'Budget and prizes' },
  { step: 3, label: 'Schedule', description: 'Start and end dates' },
  { step: 4, label: 'Cover', description: 'Visual identity' },
  { step: 5, label: 'Review', description: 'Review and publish' },
];

export const stepBasicsSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(120),
  briefMd: z.string().min(20, 'Brief must be at least 20 characters').max(5000),
  networks: z
    .array(z.enum(['tiktok', 'instagram', 'youtube', 'twitter']))
    .min(1, 'Select at least one platform'),
});

export const stepBudgetSchema = z
  .object({
    budgetCents: z.number().min(10000, 'Minimum budget is €100').max(10000000),
    prizePoolCents: z.number().min(5000, 'Minimum prize pool is €50'),
    currency: z.enum(['EUR', 'USD']),
    maxWinners: z.number().int().min(1).max(100),
  })
  .refine((d) => d.prizePoolCents <= d.budgetCents, {
    message: 'Prize pool cannot exceed budget',
    path: ['prizePoolCents'],
  });

export const stepScheduleSchema = z
  .object({
    startAt: z.date().min(new Date(), 'Start date must be in the future'),
    endAt: z.date(),
  })
  .refine((d) => d.endAt > d.startAt, {
    message: 'End date must be after start date',
    path: ['endAt'],
  });

