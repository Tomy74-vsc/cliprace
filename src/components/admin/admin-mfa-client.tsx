'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToastContext } from '@/hooks/use-toast-context';
import { getCsrfToken } from '@/lib/csrf-client';

type MfaStatusResponse = {
  ok: boolean;
  required: boolean;
  enrolled: boolean;
  enabled: boolean;
  verified: boolean;
};

type EnrollResponse = {
  ok: boolean;
  secret: string;
  otpauth_url: string;
  qr_data_url: string;
};

export function AdminMfaClient({ nextPath }: { nextPath?: string }) {
  const router = useRouter();
  const { toast } = useToastContext();

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<MfaStatusResponse | null>(null);

  const [enrolling, setEnrolling] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [manualSecret, setManualSecret] = useState<string>('');
  const [code, setCode] = useState('');

  const destination = useMemo(() => {
    if (nextPath && nextPath.startsWith('/app/admin')) return nextPath;
    return '/app/admin/dashboard';
  }, [nextPath]);

  const refreshStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/mfa/status', { cache: 'no-store' });
      const data = (await res.json().catch(() => null)) as MfaStatusResponse | null;
      if (!res.ok || !data?.ok) throw new Error('Impossible de charger le statut MFA.');
      setStatus(data);
    } catch (e) {
      toast({
        type: 'error',
        title: 'Erreur',
        message: e instanceof Error ? e.message : 'Erreur inconnue',
      });
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enroll = async () => {
    setEnrolling(true);
    try {
      const csrf = await getCsrfToken();
      const res = await fetch('/api/admin/mfa/enroll', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-csrf': csrf },
        body: JSON.stringify({}),
      });
      const data = (await res.json().catch(() => null)) as EnrollResponse | null;
      if (!res.ok || !data?.ok) {
        const msg = data && typeof (data as unknown as { message?: unknown }).message === 'string'
          ? String((data as unknown as { message?: unknown }).message)
          : '';
        throw new Error(msg || 'Impossible de démarrer l’enrôlement.');
      }
      setQrDataUrl(data.qr_data_url);
      setManualSecret(data.secret);
      toast({ type: 'success', title: 'OK', message: 'MFA prête. Scanne le QR code puis saisis le code.' });
      await refreshStatus();
    } catch (e) {
      toast({
        type: 'error',
        title: 'Erreur',
        message: e instanceof Error ? e.message : 'Erreur inconnue',
      });
    } finally {
      setEnrolling(false);
    }
  };

  const verify = async () => {
    setVerifying(true);
    try {
      const csrf = await getCsrfToken();
      const res = await fetch('/api/admin/mfa/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-csrf': csrf },
        body: JSON.stringify({ code }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || 'Code invalide.');
      }
      toast({ type: 'success', title: 'MFA activée', message: 'Accès admin déverrouillé.' });
      await refreshStatus();
      router.replace(destination);
      router.refresh();
    } catch (e) {
      toast({
        type: 'error',
        title: 'Erreur',
        message: e instanceof Error ? e.message : 'Erreur inconnue',
      });
    } finally {
      setVerifying(false);
    }
  };

  const isReady = Boolean(status?.enrolled);
  const needsEnroll = Boolean(status && status.required && !status.enrolled);
  const needsVerify = Boolean(status && status.required && status.enrolled && !status.verified);

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4 py-12">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Sécurité admin (Google Authenticator)</CardTitle>
          <CardDescription>
            Une authentification à deux facteurs (TOTP) est requise pour accéder à l’interface admin.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {loading ? (
            <div className="text-sm text-muted-foreground">Chargement…</div>
          ) : status ? (
            <div className="rounded-lg border border-border bg-card/50 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span>Requise</span>
                <span className="font-medium">{status.required ? 'Oui' : 'Non'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Enrôlée</span>
                <span className="font-medium">{status.enrolled ? 'Oui' : 'Non'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Vérifiée (session)</span>
                <span className="font-medium">{status.verified ? 'Oui' : 'Non'}</span>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Statut indisponible.</div>
          )}

          {needsEnroll ? (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">
                Étape 1 : clique sur « Démarrer » puis scanne le QR code dans Google Authenticator.
              </div>
              <Button onClick={enroll} loading={enrolling} className="w-full">
                Démarrer l’enrôlement
              </Button>
            </div>
          ) : null}

          {isReady ? (
            <div className="space-y-3">
              {qrDataUrl ? (
                <div className="flex flex-col items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrDataUrl} alt="QR code MFA" className="h-48 w-48 rounded-lg border" />
                  {manualSecret ? (
                    <div className="text-xs text-muted-foreground">
                      Clé manuelle : <span className="font-mono">{manualSecret}</span>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <Input
                label="Code (6 chiffres)"
                inputMode="numeric"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\\s+/g, ''))}
              />
              <Button
                onClick={verify}
                disabled={!needsVerify || code.length < 6 || verifying}
                loading={verifying}
                className="w-full"
              >
                Vérifier et continuer
              </Button>
            </div>
          ) : null}

          {!needsEnroll && !needsVerify && status?.verified ? (
            <div className="text-sm text-muted-foreground">
              MFA OK. Tu peux continuer vers <span className="font-mono">{destination}</span>.
            </div>
          ) : null}
        </CardContent>

        <CardFooter className="flex items-center justify-between gap-2">
          <Button variant="secondary" onClick={() => router.replace('/auth/login')}>
            Changer de compte
          </Button>
          <Button variant="secondary" onClick={() => void refreshStatus()}>
            Actualiser
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
