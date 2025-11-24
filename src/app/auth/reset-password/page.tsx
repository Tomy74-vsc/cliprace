/*
Source: Page reset-password
Purpose: Demande de réinitialisation de mot de passe
*/
'use client';

import { useState } from 'react';
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
import { Mail, ArrowLeft } from 'lucide-react';
import { useCsrfToken } from '@/hooks/use-csrf-token';

const resetPasswordSchema = z.object({
  email: z.string().email('Email invalide'),
});

type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const { toast } = useToastContext();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const csrfToken = useCsrfToken();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const email = watch('email');

  const onSubmit = async (data: ResetPasswordInput) => {
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
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf': csrfToken,
        },
        body: JSON.stringify(data),
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
        title: 'Email envoyé',
        message: result.message || 'Si cet email existe, un lien de réinitialisation vous a été envoyé.',
        duration: 5000,
      });

      setSent(true);
      setLoading(false);
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

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-50 via-indigo-50/30 to-purple-50/30 dark:from-zinc-950 dark:via-indigo-950/30 dark:to-purple-950/30 px-4 py-12">
        <Card className="w-full max-w-md backdrop-blur-xl bg-white/80 dark:bg-zinc-900/80 border-zinc-200/50 dark:border-zinc-800/50 shadow-2xl">
          <CardHeader className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#635BFF] shadow-lg flex items-center justify-center">
                <Mail className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold bg-gradient-to-r from-[#635BFF] to-[#7C3AED] bg-clip-text text-transparent">
                  Email envoyé !
                </CardTitle>
                <CardDescription className="mt-1">
                  Vérifiez votre boîte de réception
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Si l'email <strong>{email}</strong> existe dans notre système, un lien de réinitialisation vous a été envoyé.
            </p>
            <p className="text-sm text-muted-foreground">
              Cliquez sur le lien dans l'email pour réinitialiser votre mot de passe. Le lien expire dans 1 heure.
            </p>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                setSent(false);
                router.push('/auth/login');
              }}
            >
              Retour à la connexion
            </Button>
            <Link
              href="/auth/login"
              className="text-sm text-center text-[#635BFF] hover:underline"
            >
              <ArrowLeft className="w-4 h-4 inline mr-1" />
              Retour
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-50 via-indigo-50/30 to-purple-50/30 dark:from-zinc-950 dark:via-indigo-950/30 dark:to-purple-950/30 px-4 py-12">
      <Card className="w-full max-w-md backdrop-blur-xl bg-white/80 dark:bg-zinc-900/80 border-zinc-200/50 dark:border-zinc-800/50 shadow-2xl">
        <CardHeader className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#635BFF] shadow-lg flex items-center justify-center">
              <Mail className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-[#635BFF] to-[#7C3AED] bg-clip-text text-transparent">
                Réinitialiser le mot de passe
              </CardTitle>
              <CardDescription className="mt-1">
                Entrez votre email pour recevoir un lien de réinitialisation
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <CardContent className="space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder="votre@email.com"
              autoComplete="email"
              aria-required="true"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'email-error' : undefined}
              {...register('email')}
              error={errors.email?.message}
              className="transition-all duration-200 focus:scale-[1.01]"
            />
          </CardContent>

          <CardFooter className="flex flex-col gap-4 pt-6">
            <Button
              type="submit"
              className="w-full relative overflow-hidden group"
              loading={loading || isSubmitting}
              disabled={loading || isSubmitting}
            >
              <span className="relative z-10">Envoyer le lien</span>
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
