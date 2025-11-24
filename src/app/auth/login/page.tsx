// Source: Page login
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { loginSchema, type LoginInput } from '@/lib/validators/auth';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || undefined;
  const verified = searchParams.get('verified');
  const prefillEmail = searchParams.get('email') || '';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: prefillEmail,
    },
  });

  useEffect(() => {
    const fetchCsrfToken = async () => {
      try {
        const response = await fetch('/api/auth/csrf', {
          method: 'GET',
          credentials: 'include',
        });
        const result = await response.json();
        if (response.ok && result?.ok && result.token) {
          setCsrfToken(result.token);
        } else {
          console.error('Failed to fetch CSRF token', result);
        }
      } catch (csrfError) {
        console.error('CSRF token fetch failed', csrfError);
      }
    };
    fetchCsrfToken();
  }, []);

  const onSubmit = async (data: LoginInput) => {
    setLoading(true);
    setError(null);

    if (!csrfToken) {
      setError('Token CSRF manquant. Veuillez rafraîchir la page.');
      setLoading(false);
      return;
    }

    try {
      const payload: LoginInput = {
        email: data.email,
        password: data.password,
      };

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        setError(result.message || 'Une erreur est survenue lors de la connexion');
        setLoading(false);
        return;
      }

      if (!result.session?.access_token || !result.session?.refresh_token) {
        setError('Session invalide. Veuillez réessayer.');
        setLoading(false);
        return;
      }

      const syncResponse = await fetch('/api/auth/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({
          access_token: result.session.access_token,
          refresh_token: result.session.refresh_token,
        }),
      });

      if (!syncResponse.ok) {
        setError("Impossible de synchroniser la session. Veuillez réessayer.");
        setLoading(false);
        return;
      }

      const profileResponse = await fetch('/api/auth/me', {
        credentials: 'include',
      });
      const profileResult = await profileResponse.json();

      if (!profileResponse.ok || !profileResult.ok) {
        setError('Erreur lors de la récupération du profil');
        setLoading(false);
        return;
      }

      if (redirect) {
        router.push(redirect);
      } else if (profileResult.user.role === 'creator') {
        router.push('/app/creator/dashboard');
      } else if (profileResult.user.role === 'brand') {
        router.push('/app/brand/dashboard');
      } else if (profileResult.user.role === 'admin') {
        router.push('/app/admin/dashboard');
      } else {
        router.push('/app/creator/dashboard');
      }
    } catch (err) {
      setError('Une erreur est survenue lors de la connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#635BFF] shadow-lg" />
            <CardTitle className="text-2xl">Se connecter</CardTitle>
          </div>
          <CardDescription>
            Connectez-vous à votre compte ClipRace
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {verified && (
              <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-sm text-green-700 dark:text-green-400">
                Votre email a bien été vérifié. Connectez-vous pour accéder à l'application.
              </div>
            )}

            {error && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            <Input
              label="Email"
              type="email"
              placeholder="votre@email.com"
              {...register('email')}
              error={errors.email?.message}
            />

            <Input
              label="Mot de passe"
              type="password"
              placeholder="Votre mot de passe"
              {...register('password')}
              error={errors.password?.message}
            />
          </CardContent>

          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" loading={loading}>
              Se connecter
            </Button>
            <p className="text-sm text-center text-zinc-500 dark:text-zinc-400">
              Pas encore de compte ?{' '}
              <Link href="/auth/signup" className="text-[#635BFF] hover:underline font-medium">
                Créer un compte
              </Link>
            </p>
            <Link
              href="/auth/reset-password"
              className="text-sm text-center text-[#635BFF] hover:underline"
            >
              Mot de passe oublié ?
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

