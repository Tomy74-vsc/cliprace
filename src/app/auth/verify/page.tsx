'use client';

/*
Page: /auth/verify
Purpose: Écran de vérification d'email.
- Après signup : affichage "vérifiez vos emails" + bouton renvoi de l&apos;email.
- Ensuite : toutes les 2s, vérifie côté serveur si l&apos;email est confirmé dans Supabase;
  dès que c'est le cas, redirige vers /auth/login avec un message de succès et
  un redirect vers l'onboarding.
*/

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useCsrfToken } from '@/hooks/use-csrf-token';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Mail, AlertTriangle, Loader2 } from 'lucide-react';

type VerifyStatus = {
  ok: boolean;
  exists: boolean;
  verified: boolean;
};

function VerifyInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const csrfToken = useCsrfToken();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  const email = useMemo(() => searchParams.get('email') || '', [searchParams]);

  useEffect(() => {
    let isMounted = true;
    let intervalId: number | null = null;

    const checkStatus = async () => {
      if (!email || !isMounted) {
        setLoading(false);
        return;
      }
      try {
        const resp = await fetch(
          `/api/auth/verify-status?email=${encodeURIComponent(email)}`
        );
        const data = (await resp.json()) as VerifyStatus;

        if (!data.ok) {
          setError('Erreur lors de la vérification du statut de votre email.');
          setLoading(false);
          return;
        }

        if (!data.exists) {
          setError(
            "Nous ne trouvons pas ce compte. Vérifiez l'adresse email utilisée ou recommencez l'inscription."
          );
          setLoading(false);
          return;
        }

        if (data.verified) {
          // Email confirmé côté Supabase → rediriger vers login avec redirect onboarding
          setInfo(
            "Votre email a bien été vérifié. Redirection vers la connexion..."
          );
          setLoading(false);
          if (intervalId !== null) {
            window.clearInterval(intervalId);
          }
          const params = new URLSearchParams();
          params.set('redirect', '/app/onboarding');
          params.set('verified', '1');
          if (email) params.set('email', email);
          router.replace(`/auth/login?${params.toString()}`);
        } else {
          // Pas encore vérifié : état d'attente
          if (!resent) {
            setInfo(
              email
                ? `Un email de vérification a été envoyé à ${email}. Cliquez sur le lien dans l&apos;email, puis revenez sur cette page.`
                : "Un email de vérification vous a été envoyé. Cliquez sur le lien dans l&apos;email, puis revenez sur cette page."
            );
          }
          setLoading(false);
        }
      } catch (e) {
        if (!isMounted) return;
        setError(
          e instanceof Error
            ? e.message
            : 'Erreur lors de la vérification du statut de votre email.'
        );
        setLoading(false);
      }
    };

    if (email) {
      // Vérification immédiate puis toutes les 2s
      void checkStatus();
      intervalId = window.setInterval(checkStatus, 2000);
    } else {
      setLoading(false);
      setError(
        "Adresse email manquante. Retournez à l'inscription pour recommencer."
      );
    }

    return () => {
      isMounted = false;
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, [email, resent, router]);

  const onResend = async () => {
    if (!email) {
      setError("Adresse email manquante. Retournez à l'inscription pour recommencer.");
      return;
    }
    if (!csrfToken) {
      setError('Token CSRF manquant. Rafraîchissez la page.');
      return;
    }
    setLoading(true);
    setError(null);
    setInfo("Renvoi de l&apos;email de vérification...");
    try {
      const resp = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf': csrfToken },
        body: JSON.stringify({ email }),
      });
      const data = await resp.json();
      if (!resp.ok || !data?.ok) {
        throw new Error(data?.message || "Impossible de renvoyer l&apos;email");
      }
      setResent(true);
      setInfo("Un nouvel email de vérification vient d'être envoyé.");
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-50 via-indigo-50/30 to-purple-50/30 dark:from-zinc-950 dark:via-indigo-950/30 dark:to-purple-950/30 px-4 py-12">
      <Card className="w-full max-w-md backdrop-blur-xl bg-white/80 dark:bg-zinc-900/80 border-zinc-200/50 dark:border-zinc-800/50 shadow-2xl">
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#635BFF] shadow-lg flex items-center justify-center">
              {loading ? (
                <Loader2 className="h-6 w-6 text-white animate-spin" />
              ) : error ? (
                <AlertTriangle className="h-6 w-6 text-white" />
              ) : (
                <Mail className="h-6 w-6 text-white" />
              )}
            </div>
            <div>
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-[#635BFF] to-[#7C3AED] bg-clip-text text-transparent">
                Vérification de l&apos;email
              </CardTitle>
              <CardDescription className="mt-1">
                {loading
                  ? 'Vérification en cours...'
                  : error
                  ? "Nous n&apos;avons pas pu vérifier votre email"
                  : "Vérifiez votre boîte mail puis revenez sur cette page."}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {info && (
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-300">
              {info}
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {!loading && !error && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Si vous n&apos;avez pas reçu l&apos;email, vous pouvez le renvoyer.
              </p>
              <Button onClick={onResend} disabled={loading || resent} className="w-full">
                <Mail className="w-4 h-4 mr-2" />
                {resent ? 'Email renvoyé' : "Renvoyer l&apos;email"}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Adresse cible: <span className="font-medium">{email || 'inconnue'}</span>
              </p>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-2">
          <Link href="/auth/login" className="text-sm text-center text-[#635BFF] hover:underline">
            Revenir à la connexion
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-50 via-indigo-50/30 to-purple-50/30 dark:from-zinc-950 dark:via-indigo-950/30 dark:to-purple-950/30 px-4 py-12">
          <div className="text-sm text-muted-foreground">Chargement...</div>
        </div>
      }
    >
      <VerifyInner />
    </Suspense>
  );
}
