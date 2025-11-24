/*
Source: Page reset-password/confirm
Purpose: Confirme la réinitialisation avec nouveau mot de passe
*/
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useToastContext } from '@/hooks/use-toast-context';
import { motion } from 'framer-motion';
import { Lock, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useCsrfToken } from '@/hooks/use-csrf-token';
import { supabase } from '@/lib/supabase/client';

const confirmResetPasswordSchema = z.object({
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
  confirmPassword: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword'],
});

type ConfirmResetPasswordInput = z.infer<typeof confirmResetPasswordSchema>;

type SessionTokens = {
  access_token: string;
  refresh_token: string;
};

export default function ConfirmResetPasswordPage() {
  const router = useRouter();
  const { toast } = useToastContext();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [tokens, setTokens] = useState<SessionTokens | null>(null);
  const [tokensReady, setTokensReady] = useState(false);
  const csrfToken = useCsrfToken();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<ConfirmResetPasswordInput>({
    resolver: zodResolver(confirmResetPasswordSchema),
  });

  const password = watch('password');
  const confirmPassword = watch('confirmPassword');

  useEffect(() => {
    let isMounted = true;

    const parseTokens = (raw: string | null) => {
      if (!raw) return null;
      const serialized = raw.startsWith('#') ? raw.slice(1) : raw.startsWith('?') ? raw.slice(1) : raw;
      const params = new URLSearchParams(serialized);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      if (accessToken && refreshToken) {
        return { access_token: accessToken, refresh_token: refreshToken };
      }
      return null;
    };

    const hydrateTokens = async () => {
      try {
        const { data, error } = await supabase.auth.getSessionFromUrl({
          storeSession: false,
        });

        if (!error && data.session?.access_token && data.session?.refresh_token) {
          await supabase.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          });

          if (isMounted) {
            setTokens({
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token,
            });
            window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
            setTokensReady(true);
            return;
          }
        }
      } catch {
        // Ignore and fallback to manual parsing
      }

      const hashTokens = typeof window !== 'undefined' ? parseTokens(window.location.hash) : null;
      if (hashTokens) {
        await supabase.auth.setSession(hashTokens).catch(() => void 0);
        if (isMounted) {
          setTokens(hashTokens);
          window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
          setTokensReady(true);
        }
        return;
      }

      const searchTokens = typeof window !== 'undefined' ? parseTokens(window.location.search) : null;
      if (searchTokens) {
        await supabase.auth.setSession(searchTokens).catch(() => void 0);
        if (isMounted) {
          setTokens(searchTokens);
          setTokensReady(true);
        }
        return;
      }

      if (isMounted) {
        setTokenError('Lien de rǸinitialisation invalide ou expirǸ. Demandez un nouvel email.');
        setTokensReady(true);
      }
    };

    hydrateTokens();

    return () => {
      isMounted = false;
    };
  }, []);

  const onSubmit = async (data: ConfirmResetPasswordInput) => {
    if (!csrfToken) {
      toast({
        type: 'error',
        title: 'Erreur de sécurité',
        message: 'Token CSRF manquant. Veuillez rafraîchir la page.',
      });
      return;
    }

    if (!tokens) {
      toast({
        type: 'error',
        title: 'Lien invalide',
        message: 'Le lien de r?initialisation semble invalide ou expir?.',
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf': csrfToken,
        },
        body: JSON.stringify({
          password: data.password,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
        }),
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
        title: 'Mot de passe mis à jour',
        message: result.message || 'Votre mot de passe a été mis à jour avec succès.',
        duration: 5000,
      });

      setSuccess(true);
      setLoading(false);

      // Rediriger vers login après 2 secondes
      setTimeout(() => {
        router.push('/auth/login');
      }, 2000);
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

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-50 via-indigo-50/30 to-purple-50/30 dark:from-zinc-950 dark:via-indigo-950/30 dark:to-purple-950/30 px-4 py-12">
        <Card className="w-full max-w-md backdrop-blur-xl bg-white/80 dark:bg-zinc-900/80 border-zinc-200/50 dark:border-zinc-800/50 shadow-2xl">
          <CardHeader className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 shadow-lg flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold text-green-600 dark:text-green-400">
                  Mot de passe mis à jour !
                </CardTitle>
                <CardDescription className="mt-1">
                  Votre mot de passe a été réinitialisé avec succès
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Redirection vers la page de connexion...
            </p>
          </CardContent>
          <CardFooter>
            <Button
              className="w-full"
              onClick={() => router.push('/auth/login')}
            >
              Se connecter
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const submitDisabled = loading || isSubmitting || !tokensReady || !!tokenError;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-50 via-indigo-50/30 to-purple-50/30 dark:from-zinc-950 dark:via-indigo-950/30 dark:to-purple-950/30 px-4 py-12">
      <Card className="w-full max-w-md backdrop-blur-xl bg-white/80 dark:bg-zinc-900/80 border-zinc-200/50 dark:border-zinc-800/50 shadow-2xl">
        <CardHeader className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#635BFF] shadow-lg flex items-center justify-center">
              <Lock className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-[#635BFF] to-[#7C3AED] bg-clip-text text-transparent">
                Nouveau mot de passe
              </CardTitle>
              <CardDescription className="mt-1">
                Entrez votre nouveau mot de passe
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <CardContent className="space-y-4">
            {!tokensReady && !tokenError && (
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-300">
                Analyse du lien de rǸinitialisation...
              </div>
            )}

            {tokenError && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-400">
                {tokenError}
              </div>
            )}

            <Input
              label="Nouveau mot de passe"
              type="password"
              placeholder="Minimum 8 caractères"
              autoComplete="new-password"
              aria-required="true"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'password-error' : undefined}
              {...register('password')}
              error={errors.password?.message}
              className="transition-all duration-200 focus:scale-[1.01]"
            />

            <Input
              label="Confirmer le mot de passe"
              type="password"
              placeholder="Répétez le mot de passe"
              autoComplete="new-password"
              aria-required="true"
              aria-invalid={!!errors.confirmPassword}
              aria-describedby={errors.confirmPassword ? 'confirm-password-error' : undefined}
              {...register('confirmPassword')}
              error={errors.confirmPassword?.message}
              className="transition-all duration-200 focus:scale-[1.01]"
            />

            {password && confirmPassword && password === confirmPassword && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-sm text-green-600 dark:text-green-400"
              >
                Les mots de passe correspondent
              </motion.div>
            )}
          </CardContent>

          <CardFooter className="flex flex-col gap-4 pt-6">
            <Button
              type="submit"
              className="w-full relative overflow-hidden group"
              loading={loading || isSubmitting}
              disabled={submitDisabled}
            >
              <span className="relative z-10">Réinitialiser le mot de passe</span>
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-[#534BFF] to-[#6D28D9]"
                initial={{ x: '-100%' }}
                whileHover={{ x: 0 }}
                transition={{ duration: 0.3 }}
              />
            </Button>

            <Link
              href="/auth/login"
              className="text-sm text-center text-[#635BFF] hover:underline flex items-center justify-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour à la connexion
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

