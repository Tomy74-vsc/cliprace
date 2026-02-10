import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { z } from 'zod';
import {
  step1Schema,
  step2Schema,
  step3Schema,
  step4Schema,
  wizardSchema,
  type ContestWizardData,
} from '@/lib/validators/contest-wizard';
import { calculatePrizeDistribution } from '@/lib/contest-math';

type WizardStep = 1 | 2 | 3 | 4 | 5;

type WizardErrors = Record<string, string>;

type ContestWizardState = {
  currentStep: WizardStep;
  data: ContestWizardData;
  isValid: boolean;
  platformFeeCents: number;
  totalPriceCents: number;
  errors: WizardErrors;
  setData: (partial: Partial<ContestWizardData>) => void;
  nextStep: () => void;
  prevStep: () => void;
  reset: () => void;
};

const DEFAULT_DATA: ContestWizardData = {
  contest_type: 'cash',
  product_details: undefined,
  title: '',
  description: '',
  prize_amount: undefined,
  shipping_info: undefined,
  start_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  end_at: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
  platforms: ['tiktok'],
};

function computePlatformFeeCents(data: ContestWizardData): number {
  return data.contest_type === 'product' ? 5000 : 0;
}

function computeTotalPriceCents(data: ContestWizardData): number {
  if (data.contest_type === 'cash') {
    return data.prize_amount ?? 0;
  }
  // Produit: 50€ HT + TVA 20% = 60€
  return 6000;
}

function collectWizardErrors(error: z.ZodError): WizardErrors {
  const result: WizardErrors = {};
  for (const issue of error.issues) {
    const path = issue.path.join('.') || 'form';
    if (!result[path]) {
      result[path] = issue.message;
    }
  }
  return result;
}

export function validateWizardStep(
  step: WizardStep,
  data: ContestWizardData
): { valid: boolean; errors: WizardErrors } {
  if (step === 1) {
    const res = step1Schema.safeParse({
      contest_type: data.contest_type,
      product_details: data.product_details,
    });
    if (res.success) return { valid: true, errors: {} };
    return { valid: false, errors: collectWizardErrors(res.error) };
  }

  if (step === 2) {
    const res = step2Schema.safeParse({
      title: data.title,
      description: data.description,
    });
    if (res.success) return { valid: true, errors: {} };
    return { valid: false, errors: collectWizardErrors(res.error) };
  }

  if (step === 3) {
    const res = step3Schema.safeParse({
      contest_type: data.contest_type,
      prize_amount: data.prize_amount,
      shipping_info: data.shipping_info,
    });
    if (res.success) return { valid: true, errors: {} };
    return { valid: false, errors: collectWizardErrors(res.error) };
  }

  if (step === 4) {
    const res = step4Schema.safeParse({
      start_at: data.start_at,
      end_at: data.end_at,
      platforms: data.platforms,
    });
    if (res.success) return { valid: true, errors: {} };
    return { valid: false, errors: collectWizardErrors(res.error) };
  }

  // step 5 (review / global)
  const res = wizardSchema.safeParse(data);
  if (res.success) return { valid: true, errors: {} };
  return { valid: false, errors: collectWizardErrors(res.error) };
}

export const useContestWizard = create<ContestWizardState>()(
  persist(
    (set, get) => ({
      currentStep: 1,
      data: DEFAULT_DATA,
      isValid: false,
      platformFeeCents: computePlatformFeeCents(DEFAULT_DATA),
      totalPriceCents: computeTotalPriceCents(DEFAULT_DATA),
      errors: {},

      setData(partial) {
        set((state) => {
          const nextData = { ...state.data, ...partial };

          // Ajuster la distribution des gains côté store (pour estimation / preview)
          if (
            nextData.contest_type === 'cash' &&
            typeof nextData.prize_amount === 'number' &&
            nextData.prize_amount > 0
          ) {
            const podium = calculatePrizeDistribution(nextData.prize_amount);
            // La distribution détaillée sera surtout utilisée côté UI;
            // ici, on ne stocke que le montant total (déjà pris en compte).
            void podium;
          }

          const platformFeeCents = computePlatformFeeCents(nextData);
          const totalPriceCents = computeTotalPriceCents(nextData);

          const validation = validateWizardStep(state.currentStep, nextData);

          return {
            data: nextData,
            platformFeeCents,
            totalPriceCents,
            isValid: validation.valid,
            errors: validation.errors,
          };
        });
      },

      nextStep() {
        const state = get();
        const { currentStep, data } = state;

        const currentValidation = validateWizardStep(currentStep, data);
        if (!currentValidation.valid) {
          set({ isValid: false, errors: currentValidation.errors });
          return;
        }

        const nextStep = (currentStep + 1) as WizardStep;
        const clampedNext = nextStep > 5 ? 5 : nextStep;
        const nextValidation = validateWizardStep(clampedNext, data);
        set({
          currentStep: clampedNext,
          isValid: nextValidation.valid,
          errors: nextValidation.errors,
        });
      },

      prevStep() {
        const state = get();
        const prev = (state.currentStep - 1) as WizardStep;
        set({
          currentStep: prev < 1 ? 1 : prev,
          // on ne re-valide pas en arrière; les erreurs seront recalculées à la prochaine saisie
          errors: {},
        });
      },

      reset() {
        set({
          currentStep: 1,
          data: DEFAULT_DATA,
          isValid: false,
          platformFeeCents: computePlatformFeeCents(DEFAULT_DATA),
          totalPriceCents: computeTotalPriceCents(DEFAULT_DATA),
          errors: {},
        });
      },
    }),
    {
      name: 'contest-wizard-v1',
      partialize: (state) =>
        ({
          currentStep: state.currentStep,
          data: state.data,
        } satisfies Pick<ContestWizardState, 'currentStep' | 'data'>),
    }
  )
);

export type { ContestWizardData } from '@/lib/validators/contest-wizard';

