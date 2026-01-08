'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type TotpFactor = { id: string; factor_type?: string };

export default function AdminMfaVerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const nextParam = searchParams.get('next') ?? '';
  const destination = useMemo(() => (nextParam.startsWith('/app/admin') ? nextParam : '/app/admin'), [nextParam]);

  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string>('');
  const [otp, setOtp] = useState('');
  const [factorId, setFactorId] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError('');
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          router.replace('/auth/login?redirect=/app/admin/mfa/verify');
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (profileError || !profile || profile.role !== 'admin') {
          router.replace('/forbidden');
          return;
        }

        const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
        if (factorsError) throw factorsError;

        const totpFactor = ((factors?.totp ?? [])[0] ?? null) as TotpFactor | null;
        if (!totpFactor?.id) {
          router.replace('/app/admin/mfa/setup');
          return;
        }

        if (!cancelled) setFactorId(totpFactor.id);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erreur inconnue');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const submit = async () => {
    setVerifying(true);
    setError('');
    try {
      const code = otp.replace(/\s+/g, '');
      if (!/^\d{6}$/.test(code)) {
        setError('Le code doit contenir 6 chiffres.');
        return;
      }
      if (!factorId) {
        setError('Facteur MFA introuvable. Réessaie.');
        return;
      }

      const { data, error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code,
      });
      if (verifyError || !data) throw verifyError ?? new Error('Vérification impossible.');

      router.replace(destination);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Code invalide.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12 bg-zinc-50 dark:bg-zinc-950">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Vérification MFA</CardTitle>
          <CardDescription>Entre le code à 6 chiffres généré par ton authenticator.</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {loading ? <div className="text-sm text-muted-foreground">Chargement…</div> : null}
          {!loading && error ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <Input
            label="Code (6 chiffres)"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            value={otp}
            maxLength={6}
            onChange={(e) => setOtp(e.target.value.replace(/[^\d]/g, ''))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit();
            }}
          />
        </CardContent>

        <CardFooter className="flex items-center justify-between gap-2">
          <Button variant="secondary" onClick={() => router.replace('/app/admin/mfa/setup')}>
            Reconfigurer
          </Button>
          <Button onClick={() => void submit()} loading={verifying} disabled={loading || verifying || otp.length !== 6}>
            Valider
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}


