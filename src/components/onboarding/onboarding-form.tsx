/*
Source: Component OnboardingForm
Purpose: Formulaire multi-étapes pour onboarding créateur/marque
*/
'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { profileCompleteSchema, type ProfileCompleteInput } from '@/lib/validators/auth';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import { useToastContext } from '@/hooks/use-toast-context';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, CheckCircle2, User, Building2, Globe, FileText } from 'lucide-react';
import type { UserRole } from '@/lib/auth';
import { useCsrfToken } from '@/hooks/use-csrf-token';
import { PlatformConnectStep } from '@/components/onboarding/platform-connect-step';

type CreatorPlatformKey = keyof NonNullable<ProfileCompleteInput['platform_links']>;

interface OnboardingFormProps {
  role: UserRole;
  initialData?: Partial<ProfileCompleteInput>;
  connectedPlatforms?: Array<{ platform: string; handle: string | null }>;
}

export function OnboardingForm({ role, initialData, connectedPlatforms = [] }: OnboardingFormProps) {
  const router = useRouter();
  const { toast } = useToastContext();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const csrfToken = useCsrfToken();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const totalSteps = role === 'creator' ? 4 : 4; // Creator: 4 étapes, Brand: 4 étapes

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
    trigger,
  } = useForm<ProfileCompleteInput>({
    resolver: zodResolver(profileCompleteSchema),
    defaultValues: initialData,
    mode: 'onBlur',
  });

  // Validation des étapes (aligné avec le schéma Zod - champs optionnels)
  const validateStep = async (step: number): Promise<boolean> => {
    if (role === 'creator') {
      if (step === 1) {
        // Étape 1: username et primary_platform sont requis
        return await trigger(['username', 'primary_platform']);
      } else if (step === 2) {
        // Étape 2: connexion plateformes OAuth (pas de champs formulaire)
        return true;
      } else if (step === 3) {
        // Étape 3: followers et avg_views sont optionnels selon le schéma
        return true;
      } else if (step === 4) {
        // Étape 4: bio est maintenant requise
        return await trigger(['bio']);
      }
    } else if (role === 'brand') {
      if (step === 1) {
        // Étape 1: company_name est requis
        return await trigger(['company_name']);
      } else if (step === 2) {
        // Étape 2: vat_number est optionnel selon le schéma
        return true; // Permet de passer même si vide
      } else if (step === 3) {
        // Étape 3: adresse - certains champs sont requis
        return await trigger(['address_line1', 'address_city', 'address_postal_code', 'address_country']);
      } else if (step === 4) {
        // Étape 4: bio est optionnel selon le schéma
        return true; // Permet de passer même si vide
      }
    }
    return true;
  };

  useEffect(() => {
    const error = searchParams.get('error');
    const platform = searchParams.get('platform');
    const reason = searchParams.get('reason');
    const connected = searchParams.get('connected');

    const hasOAuthFeedback = Boolean(error || (connected === 'true' && platform));
    if (!hasOAuthFeedback) {
      return;
    }

    const platformLabel: Record<string, string> = {
      youtube: 'YouTube',
      tiktok: 'TikTok',
      instagram: 'Instagram',
    };

    if (connected === 'true' && platform) {
      const successLabel = platformLabel[platform] ?? platform;
      toast({
        type: 'success',
        title: `${successLabel} connecté !`,
        message: `Ton compte ${successLabel} a bien été lié à ClipRace.`,
        duration: 4000,
      });
    }

    if (error) {
      const pLabel = platform ? (platformLabel[platform] ?? platform) : 'la plateforme';

      const title = 'Connexion impossible';
      let message: string;

      if (error === 'oauth_misconfigured') {
        message = `La connexion ${pLabel} n'est pas encore activée. Contacte le support.`;
      } else if (error === 'oauth_provider_error' && reason === 'access_denied') {
        message = `Tu as refusé l'accès à ${pLabel}. Réessaie quand tu veux.`;
      } else if (error === 'oauth_provider_error') {
        message = `${pLabel} a retourné une erreur. Réessaie dans quelques instants.`;
      } else {
        message = `Une erreur technique s'est produite lors de la connexion à ${pLabel}. Réessaie.`;
      }

      toast({ type: 'error', title, message, duration: 7000 });
    }

    const cleanParams = new URLSearchParams(searchParams.toString());
    cleanParams.delete('error');
    cleanParams.delete('platform');
    cleanParams.delete('reason');
    cleanParams.delete('connected');

    const newSearch = cleanParams.toString();
    router.replace(newSearch ? `${pathname}?${newSearch}` : pathname, {
      scroll: false,
    });
  }, [pathname, router, searchParams, toast]);

  const handleNext = async () => {
    const isValid = await validateStep(currentStep);
    if (isValid && currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const onSubmit = async (data: ProfileCompleteInput) => {
    if (!csrfToken) {
      toast({
        type: 'error',
        title: 'Erreur de sécurité',
        message: 'Token CSRF manquant. Veuillez rafraîchir la page.',
      });
      return;
    }

    setLoading(true);

    try {
      const platformLinksPayload = data.platform_links
        ? Object.entries(data.platform_links).reduce((acc, [key, value]) => {
            acc[key as CreatorPlatformKey] = typeof value === 'string' ? value.trim() : value;
            return acc;
          }, {} as NonNullable<ProfileCompleteInput['platform_links']>)
        : undefined;

      const payload: ProfileCompleteInput = {
        ...data,
        platform_links: platformLinksPayload,
      };

      const response = await fetch('/api/profile/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf': csrfToken,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        toast({
          type: 'error',
          title: 'Erreur',
          message: result.message || 'Une erreur est survenue',
          duration: 7000,
        });
        setLoading(false);
        return;
      }

      toast({
        type: 'success',
        title: 'Onboarding complété !',
        message: 'Votre profil a été complété avec succès.',
        duration: 3000,
      });

      // Rediriger vers dashboard selon rôle
      setTimeout(() => {
        if (role === 'creator') {
          router.push('/app/creator/dashboard');
        } else if (role === 'brand') {
          router.push('/app/brand/dashboard');
        }
      }, 1500);
    } catch (err) {
      toast({
        type: 'error',
        title: 'Erreur',
        message: 'Une erreur est survenue. Veuillez réessayer.',
        duration: 7000,
      });
      setLoading(false);
    }
  };

  // Render step content
  const renderStepContent = () => {
    if (role === 'creator') {
      switch (currentStep) {
        case 1:
          return (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <User className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold">Informations de base</h3>
              </div>
              <Input
                label="Pseudo / Handle"
                placeholder="votre_pseudo"
                {...register('username')}
                error={errors.username?.message}
                helpText="Votre nom d'utilisateur sur vos plateformes"
              />
              <div>
                <div className="block text-sm font-medium mb-1.5" id="primary-platform-label">
                  Plateforme principale <span className="text-red-500">*</span>
                </div>
                <Controller
                  name="primary_platform"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full" aria-labelledby="primary-platform-label">
                        <SelectValue placeholder="Sélectionnez une plateforme" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tiktok">TikTok</SelectItem>
                        <SelectItem value="instagram">Instagram</SelectItem>
                        <SelectItem value="youtube">YouTube</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.primary_platform && (
                  <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                    {errors.primary_platform.message}
                  </p>
                )}
              </div>
              <p className="text-xs text-[var(--text-3)]">
                Tu pourras connecter tes comptes à l&apos;étape suivante.
              </p>
            </div>
          );
        case 2:
          return (
            <PlatformConnectStep
              connectedPlatforms={connectedPlatforms}
              onSkip={() => setCurrentStep(3)}
              onContinue={() => setCurrentStep(3)}
            />
          );
        case 3:
          return (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Globe className="w-5 h-5 text-[#635BFF]" />
                <h3 className="text-lg font-semibold">Statistiques</h3>
              </div>
              <Input
                label="Nombre de followers"
                type="number"
                placeholder="0"
                {...register('followers', { valueAsNumber: true })}
                error={errors.followers?.message}
                helpText="Nombre approximatif de followers"
              />
              <Input
                label="Vues moyennes par vidéo"
                type="number"
                placeholder="0"
                {...register('avg_views', { valueAsNumber: true })}
                error={errors.avg_views?.message}
                helpText="Vues moyennes par vidéo"
              />
            </div>
          );
        case 4:
          return (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-[#635BFF]" />
                <h3 className="text-lg font-semibold">Bio</h3>
              </div>
              <div>
                <div className="block text-sm font-medium mb-1.5" id="bio-label-creator">
                  Bio <span className="text-zinc-500">(optionnel)</span>
                </div>
                <textarea
                  {...register('bio')}
                  aria-labelledby="bio-label-creator"
                  rows={4}
                  className="flex w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-background px-4 py-3 text-sm placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#635BFF] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Parlez-nous de vous..."
                />
                {errors.bio && (
                  <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                    {errors.bio.message}
                  </p>
                )}
              </div>
            </div>
          );
        default:
          return null;
      }
    } else if (role === 'brand') {
      switch (currentStep) {
        case 1:
          return (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="w-5 h-5 text-[#635BFF]" />
                <h3 className="text-lg font-semibold">Informations entreprise</h3>
              </div>
              <Input
                label="Nom de l'entreprise"
                placeholder="Ma Société"
                {...register('company_name')}
                error={errors.company_name?.message}
                helpText="Le nom officiel de votre entreprise"
              />
            </div>
          );
        case 2:
          return (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-[#635BFF]" />
                <h3 className="text-lg font-semibold">Informations fiscales</h3>
              </div>
              <Input
                label="Numéro TVA / SIREN"
                placeholder="FR12345678901"
                {...register('vat_number')}
                error={errors.vat_number?.message}
                helpText="Numéro TVA ou SIREN (optionnel)"
              />
            </div>
          );
        case 3:
          return (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Globe className="w-5 h-5 text-[#635BFF]" />
                <h3 className="text-lg font-semibold">Adresse</h3>
              </div>
              <Input
                label="Adresse ligne 1"
                placeholder="123 Rue Example"
                {...register('address_line1')}
                error={errors.address_line1?.message}
              />
              <Input
                label="Adresse ligne 2"
                placeholder="Complément d'adresse (optionnel)"
                {...register('address_line2')}
                error={errors.address_line2?.message}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Ville"
                  placeholder="Paris"
                  {...register('address_city')}
                  error={errors.address_city?.message}
                />
                <Input
                  label="Code postal"
                  placeholder="75001"
                  {...register('address_postal_code')}
                  error={errors.address_postal_code?.message}
                />
              </div>
              <Input
                label="Pays"
                placeholder="FR"
                {...register('address_country')}
                error={errors.address_country?.message}
                helpText="Code pays (ex: FR)"
              />
            </div>
          );
        case 4:
          return (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-[#635BFF]" />
                <h3 className="text-lg font-semibold">Bio</h3>
              </div>
              <div>
                <div className="block text-sm font-medium mb-1.5" id="bio-label-brand">
                  Bio <span className="text-zinc-500">(optionnel)</span>
                </div>
                <textarea
                  {...register('bio')}
                  aria-labelledby="bio-label-brand"
                  rows={4}
                  className="flex w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-background px-4 py-3 text-sm placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#635BFF] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Parlez-nous de votre entreprise..."
                />
                {errors.bio && (
                  <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                    {errors.bio.message}
                  </p>
                )}
              </div>
            </div>
          );
        default:
          return null;
      }
    }
    return null;
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="w-full">
      <div className="p-6 space-y-6">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Étape {currentStep} sur {totalSteps}</span>
            <span>{Math.round((currentStep / totalSteps) * 100)}%</span>
          </div>
          <div className="h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-[#635BFF] to-[#7C3AED]"
              initial={{ width: 0 }}
              animate={{ width: `${(currentStep / totalSteps) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* Step Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {renderStepContent()}
          </motion.div>
        </AnimatePresence>
      </div>

      <CardFooter className="p-6 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        {!(role === 'creator' && currentStep === 2) && (
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={handlePrevious}
              disabled={currentStep === 1 || loading || isSubmitting}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Précédent
            </Button>

            {currentStep < totalSteps ? (
              <Button
                type="button"
                onClick={handleNext}
                disabled={loading || isSubmitting}
              >
                Suivant
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button
                type="submit"
                loading={loading || isSubmitting}
                disabled={loading || isSubmitting}
              >
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Terminer
              </Button>
            )}
          </>
        )}
      </CardFooter>
    </form>
  );
}

