'use client';

import type { ComponentType } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useContestWizard } from '@/store/useContestWizard';
import { Button } from '@/components/ui/button';
import { LiveMobilePreview } from './LiveMobilePreview';
import { Step1Type } from './Steps/Step1Type';
import { Step2Brief } from './Steps/Step2Brief';
import { Step3Reward } from './Steps/Step3Reward';
import { Step4Rules } from './Steps/Step4Rules';
import { Step5Review } from './Steps/Step5Review';
import { WizardStepper } from './WizardStepper';

const STEP_CONFIG: Record<
  1 | 2 | 3 | 4 | 5,
  { title: string; subtitle: string; component: ComponentType }
> = {
  1: {
    title: 'Type de concours',
    subtitle: 'Choisis entre un cashprize ou un produit à offrir.',
    component: Step1Type,
  },
  2: {
    title: 'Brief & contenu',
    subtitle: 'Explique aux créateurs ce que tu attends.',
    component: Step2Brief,
  },
  3: {
    title: 'Récompense',
    subtitle: 'Paramètre le budget ou l’expédition produit.',
    component: Step3Reward,
  },
  4: {
    title: 'Règles & diffusion',
    subtitle: 'Définis les dates et les plateformes.',
    component: Step4Rules,
  },
  5: {
    title: 'Review & paiement',
    subtitle: 'Vérifie le ticket de caisse puis paye via Stripe.',
    component: Step5Review,
  },
};

export function ContestWizard() {
  const { currentStep, isValid, nextStep, prevStep } = useContestWizard();

  const step = STEP_CONFIG[currentStep];
  const StepComponent = step.component;

  const canGoNext = currentStep < 5;

  return (
    <div className="max-w-6xl mx-auto py-8 lg:py-10">
      <div className="mb-8 space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Création concours
        </p>
        <h1 className="text-3xl lg:text-4xl font-semibold tracking-tight">
          Configure ton prochain concours en 5 étapes
        </h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Tu peux naviguer entre les étapes, les informations sont conservées automatiquement dans
          ton navigateur.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-5">
        {/* Left column: steps */}
        <div className="lg:col-span-3 space-y-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground mb-1">
              Étape {currentStep} / 5
            </p>
            <h2 className="text-xl font-semibold">{step.title}</h2>
            <p className="text-sm text-muted-foreground">{step.subtitle}</p>
          </div>

          <WizardStepper />

          <div className="relative min-h-[260px]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="absolute inset-0"
              >
                <div className="bg-card border rounded-2xl shadow-sm p-6 lg:p-7 h-full overflow-y-auto">
                  <StepComponent />
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div>
              {currentStep > 1 && (
                <Button
                  variant="ghost"
                  size="md"
                  onClick={prevStep}
                >
                  ← Précédent
                </Button>
              )}
            </div>

            <div className="flex items-center gap-3">
              {canGoNext && (
                <Button
                  size="md"
                  onClick={nextStep}
                  disabled={!isValid}
                  className="min-w-[140px]"
                >
                  Suivant →
                </Button>
              )}
              {!canGoNext && (
                <Button
                  size="md"
                  onClick={nextStep}
                  disabled={!isValid}
                  className="min-w-[140px]"
                >
                  Finaliser
                </Button>
              )}
            </div>
          </div>

          {!isValid && (
            <p className="text-xs text-muted-foreground text-right">
              Veuillez compléter tous les champs obligatoires pour continuer.
            </p>
          )}
        </div>

        {/* Right column: live preview */}
        <div className="lg:col-span-2">
          <LiveMobilePreview />
        </div>
      </div>
    </div>
  );
}

