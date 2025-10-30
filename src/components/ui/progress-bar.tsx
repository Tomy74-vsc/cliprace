"use client";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
  className?: string;
  onStepClick?: (step: number) => void;
}

export function ProgressBar({ currentStep, totalSteps, className, onStepClick }: ProgressBarProps) {
  const progress = (currentStep / totalSteps) * 100;

  const getStepLabels = () => {
    const labels = ["Compte", "Email", "Profil"];
    return labels.slice(0, totalSteps);
  };

  const stepLabels = getStepLabels();

  return (
    <div className={cn("w-full", className)}>
      {/* Barre de progression professionnelle */}
      <div className="relative w-full mb-3">
        {/* Barre de progression principale */}
        <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-3 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ 
              duration: 0.6, 
              ease: "easeOut"
            }}
          />
        </div>

        {/* Étapes intégrées dans la barre avec positionnement professionnel */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {Array.from({ length: totalSteps }, (_, index) => {
            const stepNumber = index + 1;
            const isCompleted = stepNumber < currentStep;
            const isCurrent = stepNumber === currentStep;
            
            // Calcul de position professionnel pour 3 étapes
            let stepPosition;
            if (totalSteps === 3) {
              // Pour 3 étapes : 0% (gauche), 50% (centre), 100% (droite)
              stepPosition = index === 0 ? 0 : index === 1 ? 50 : 100;
            } else {
              // Pour d'autres nombres d'étapes
              stepPosition = (index / (totalSteps - 1)) * 100;
            }

            return (
              <motion.button
                key={index}
                type="button"
                role="button"
                tabIndex={0}
                aria-current={isCurrent ? "step" : undefined}
                aria-label={`Étape ${stepNumber}: ${stepLabels[index]}. ${isCompleted ? "Terminée" : isCurrent ? "En cours" : "En attente"}`}
                onClick={() => onStepClick?.(stepNumber)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onStepClick?.(stepNumber);
                  }
                }}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                className={cn(
                  "absolute flex items-center justify-center group focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 dark:focus:ring-offset-zinc-900 rounded-full transition-all duration-200 pointer-events-auto",
                  isCurrent && "z-10"
                )}
                style={{ 
                  left: `${stepPosition}%`,
                  transform: stepPosition === 0 ? 'translateX(0)' : stepPosition === 100 ? 'translateX(-100%)' : 'translateX(-50%)'
                }}
                // Autoriser les interactions sur les boutons, tout en laissant le conteneur ignorer les événements
                data-pointer
                
              >
                {/* Cercle de l'étape professionnel avec chiffres plus gros */}
                <motion.div
                  className={cn(
                    "w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all duration-200 shadow-sm",
                    isCompleted
                      ? "bg-indigo-500 border-indigo-500 text-white shadow-md"
                      : isCurrent
                      ? "bg-white border-indigo-500 text-indigo-500 shadow-md ring-2 ring-indigo-100 dark:ring-indigo-900/30"
                      : "bg-white border-zinc-300 dark:border-zinc-600 text-zinc-400 dark:text-zinc-500",
                    "group-hover:scale-110 group-focus:scale-110"
                  )}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <span className="text-base font-bold">{stepNumber}</span>
                  )}
                </motion.div>

                {/* Description cachée pour les lecteurs d'écran */}
                <span className="sr-only">
                  {isCompleted 
                    ? `Étape ${stepNumber} terminée: ${stepLabels[index]}`
                    : isCurrent 
                    ? `Étape ${stepNumber} en cours: ${stepLabels[index]}`
                    : `Étape ${stepNumber} en attente: ${stepLabels[index]}`
                  }
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Indicateur de progression textuel professionnel */}
      <div className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
        <span className="font-semibold">
          {stepLabels[currentStep - 1]}
        </span>
        <span className="text-zinc-500 dark:text-zinc-500 font-medium">
          {currentStep}/{totalSteps}
        </span>
      </div>

      {/* Indicateur de progression textuel pour les lecteurs d'écran */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        Progression: {Math.round(progress)}% complété. Étape {currentStep} sur {totalSteps}: {stepLabels[currentStep - 1]}
      </div>
    </div>
  );
}
