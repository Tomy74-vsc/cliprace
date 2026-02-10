'use client';

import { motion } from 'framer-motion';
import { CreditCard } from 'lucide-react';

export interface StripeConnectOnboardingProps {
  onConfigurer?: () => void;
  className?: string;
}

/**
 * Placeholder pour la configuration Stripe Connect.
 * Affiche un bloc invitant à configurer le paiement pour recevoir les retraits.
 */
export function StripeConnectOnboarding({ onConfigurer, className }: StripeConnectOnboardingProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={className}
    >
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 backdrop-blur-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-amber-500/20 p-2">
            <CreditCard className="h-5 w-5 text-amber-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-amber-200">Paiement non configuré</p>
            <p className="mt-1 text-sm text-white/70">
              Lie ton compte pour recevoir tes gains par virement.
            </p>
            <button
              type="button"
              onClick={onConfigurer}
              className="mt-3 rounded-xl bg-amber-500/20 px-4 py-2 text-sm font-medium text-amber-200 transition hover:bg-amber-500/30"
            >
              Configurer le paiement
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
