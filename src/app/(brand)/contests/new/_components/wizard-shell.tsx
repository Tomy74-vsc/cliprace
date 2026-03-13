'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { WizardFormData, WizardStep } from '../_types';
import { WIZARD_STEPS } from '../_types';
import { getCsrfToken } from '@/lib/csrf-client';
import { toast } from 'sonner';
import { Surface } from '@/components/brand-ui/Surface';
import { WizardProgress } from './wizard-progress';
import { WizardActions } from './wizard-actions';
import { StepCover } from './steps/step-cover';
import { StepReview } from './steps/step-review';
// Placeholders for other steps – to be implemented separately
import { StepBasics } from './steps/step-basics';
import { StepBudget } from './steps/step-budget';
import { StepSchedule } from './steps/step-schedule';

export function WizardShell() {
  const router = useRouter();
  const [formData, setFormData] = useState<WizardFormData>({
    title: '',
    briefMd: '',
    networks: [],
    budgetCents: 0,
    prizePoolCents: 0,
    currency: 'EUR',
    maxWinners: 1,
    startAt: null,
    endAt: null,
    coverUrl: null,
    coverFile: null,
  });
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateFormData = (patch: Partial<WizardFormData>) => {
    setFormData((prev) => ({ ...prev, ...patch }));
  };

  const nextStep = () => {
    setCurrentStep((prev) => Math.min(5, (prev + 1) as WizardStep));
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(1, (prev - 1) as WizardStep));
  };

  const handleSubmit = async (publish: boolean) => {
    setIsSubmitting(true);
    try {
      const token = await getCsrfToken();

      const payload = {
        title: formData.title,
        briefMd: formData.briefMd,
        networks: formData.networks,
        budgetCents: formData.budgetCents,
        prizePoolCents: formData.prizePoolCents,
        currency: formData.currency,
        maxWinners: formData.maxWinners,
        startAt: formData.startAt ? formData.startAt.toISOString() : null,
        endAt: formData.endAt ? formData.endAt.toISOString() : null,
        coverUrl: formData.coverUrl,
        publish,
      };

      const res = await fetch('/api/brand/contests', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'content-type': 'application/json',
          'x-csrf': token,
        },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as {
        success?: boolean;
        contestId?: string;
        error?: string;
      };

      if (!res.ok || !data.success || !data.contestId) {
        throw new Error(data.error ?? 'Creation failed');
      }

      toast.success(publish ? 'Contest published!' : 'Draft saved!');
      router.push(`/app/brand/contests/${data.contestId}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Something went wrong while creating the contest.';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  let content: React.ReactNode;
  if (currentStep === 1) {
    content = <StepBasics data={formData} onChange={updateFormData} />;
  } else if (currentStep === 2) {
    content = <StepBudget data={formData} onChange={updateFormData} />;
  } else if (currentStep === 3) {
    content = <StepSchedule data={formData} onChange={updateFormData} />;
  } else if (currentStep === 4) {
    content = <StepCover data={formData} onChange={updateFormData} />;
  } else {
    content = <StepReview data={formData} />;
  }

  return (
    <div className="brand-scope mx-auto max-w-2xl px-6 py-8">
      <WizardProgress currentStep={currentStep} steps={WIZARD_STEPS} />
      <Surface className="mt-6 p-8">
        {content}
      </Surface>
      <WizardActions
        currentStep={currentStep}
        onPrev={prevStep}
        onNext={nextStep}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}

