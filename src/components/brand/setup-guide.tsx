'use client';

import Link from 'next/link';
import type { ComponentType } from 'react';
import { motion } from 'framer-motion';
import { Building2, CheckCircle2, CreditCard, Rocket } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type SetupGuideProps = {
  profileComplete: boolean;
  billingConfigured: boolean;
  hasCampaign: boolean;
};

type Step = {
  key: string;
  title: string;
  description: string;
  href: string;
  done: boolean;
  cta: string;
  icon: ComponentType<{ className?: string }>;
  pulse?: boolean;
};

export function SetupGuide({ profileComplete, billingConfigured, hasCampaign }: SetupGuideProps) {
  const steps: Step[] = [
    {
      key: 'profile',
      title: 'Completer le profil entreprise',
      description: 'Renseigne les informations legales et de facturation.',
      href: '/app/brand/settings',
      done: profileComplete,
      cta: 'Completer',
      icon: Building2,
    },
    {
      key: 'billing',
      title: 'Configurer la facturation',
      description: 'Verifie le parcours de paiement et les factures.',
      href: '/app/brand/billing',
      done: billingConfigured,
      cta: 'Configurer',
      icon: CreditCard,
    },
    {
      key: 'campaign',
      title: 'Lancer la premiere campagne',
      description: 'Publie ton premier concours pour activer la croissance.',
      href: '/app/brand/contests/new',
      done: hasCampaign,
      cta: 'Creer un concours',
      icon: Rocket,
      pulse: true,
    },
  ];

  const completed = steps.filter((s) => s.done).length;
  const progress = Math.round((completed / steps.length) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5 shadow-sm">
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-lg">Setup Guide</CardTitle>
            <Badge variant="secondary">{completed}/3 terminees</Badge>
          </div>
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-muted-foreground">
              Complete ces etapes pour activer ton espace marque.
            </p>
          </div>
        </CardHeader>

        <CardContent className="grid gap-3 md:grid-cols-3">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.06, duration: 0.25 }}
                className={cn(
                  'rounded-xl border p-4 bg-background/80 backdrop-blur-sm',
                  step.done ? 'border-emerald-200' : 'border-border'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold leading-tight">{step.title}</p>
                    <p className="text-xs text-muted-foreground">{step.description}</p>
                  </div>
                  {step.done ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  ) : (
                    <Icon className="h-5 w-5 text-primary shrink-0" />
                  )}
                </div>

                <Button
                  asChild
                  size="sm"
                  className={cn('mt-4 w-full', step.pulse && !step.done && 'animate-pulse')}
                  variant={step.done ? 'secondary' : 'default'}
                >
                  <Link href={step.href}>{step.done ? 'Voir' : step.cta}</Link>
                </Button>
              </motion.div>
            );
          })}
        </CardContent>
      </Card>
    </motion.div>
  );
}
