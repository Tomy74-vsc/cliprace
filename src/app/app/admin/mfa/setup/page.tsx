'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

type TotpEnrollData = {
  qr_code?: string;
  secret?: string;
  uri?: string;
};

type AnyFactor = {
  id?: string;
  factor_type?: string;
  factorType?: string;
  friendly_name?: string;
  friendlyName?: string;
  created_at?: string;
  createdAt?: string;
};

function extractTotpFactors(raw: unknown): AnyFactor[] {
  const factors = raw as { totp?: unknown[]; all?: unknown[] } | null;
  const totp = Array.isArray(factors?.totp) ? (factors?.totp as AnyFactor[]) : [];
  const all = Array.isArray(factors?.all) ? (factors?.all as AnyFactor[]) : [];
  const totpFromAll = all.filter((f) => (f?.factor_type ?? f?.factorType) === 'totp');
  const byId = new Map<string, AnyFactor>();
  for (const f of [...totp, ...totpFromAll]) {
    const id = String(f?.id || '');
    if (!id) continue;
    byId.set(id, f);
  }
  return [...byId.values()];
}

function isSvgMarkup(value: string) {
  return value.trim().startsWith('<svg');
}

function isDataUrl(value: string) {
  return value.trim().startsWith('data:');
}

const STORAGE_FACTOR_ID = 'cliprace_admin_totp_factor_id';
const FRIENDLY_NAME = 'ClipRace Admin';

export default function AdminMfaSetupPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [error, setError] = useState<string>('');
  const [totp, setTotp] = useState<TotpEnrollData | null>(null);
  const [factorId, setFactorId] = useState<string>('');

  const qr = totp?.qr_code ?? '';
  const canContinue = Boolean(totp?.qr_code);

  const qrRenderMode = useMemo<'none' | 'img' | 'svg'>(
    () => {
      if (!qr) return 'none';
      if (isDataUrl(qr)) return 'img';
      if (isSvgMarkup(qr)) return 'svg';
      // fallback: try to render as img, some providers return raw image URL
      return 'img';
    },
    [qr]
  );

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
          router.replace('/auth/login?redirect=/app/admin/mfa/setup');
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

        const totpFactors = extractTotpFactors(factors);
        if (totpFactors.length > 0) {
          router.replace('/app/admin/mfa/verify');
          return;
        }

        setEnrolling(true);
        const { data: enrollData, error: enrollError } = await supabase.auth.mfa.enroll({
          factorType: 'totp',
          friendlyName: FRIENDLY_NAME,
        });
        if (enrollError) throw enrollError;

        const anyEnroll = enrollData as unknown as { id?: unknown; factorId?: unknown; totp?: TotpEnrollData } | null;
        const enrolledFactorId = String((anyEnroll?.id ?? anyEnroll?.factorId ?? '') || '');
        const nextTotp = anyEnroll?.totp ?? null;
        if (!nextTotp?.qr_code) {
          throw new Error('Impossible de récupérer le QR code TOTP.');
        }

        if (!cancelled) {
          setTotp(nextTotp);
          setFactorId(enrolledFactorId);
          if (enrolledFactorId) {
            try {
              sessionStorage.setItem(STORAGE_FACTOR_ID, enrolledFactorId);
            } catch {
              // ignore storage failures
            }
          }
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Erreur inconnue';
        // If a factor exists already (often after a refresh), send user to verify step.
        const lower = String(message || '').toLowerCase();
        if (
          lower.includes('already exists') ||
          (lower.includes('friendly name') && lower.includes('exists')) ||
          (lower.includes('factor') && lower.includes('exists'))
        ) {
          router.replace('/app/admin/mfa/verify');
          return;
        }
        if (!cancelled) setError(message);
      } finally {
        if (!cancelled) {
          setEnrolling(false);
          setLoading(false);
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12 bg-zinc-50 dark:bg-zinc-950">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Configurer la double authentification</CardTitle>
          <CardDescription>
            Pour accéder à l’interface ADMIN, configure un code TOTP via Google Authenticator ou Microsoft Authenticator.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {loading ? <div className="text-sm text-muted-foreground">Chargement…</div> : null}
          {!loading && error ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {!loading && !error ? (
            <div className="rounded-xl border border-border bg-card/50 p-4">
              <div className="text-sm font-medium">QR Code</div>
              <div className="mt-3 flex items-center justify-center rounded-lg border bg-background p-4">
                {enrolling ? (
                  <div className="text-sm text-muted-foreground">Génération du QR code…</div>
                ) : qrRenderMode === 'img' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qr} alt="QR code MFA" className="h-56 w-56" />
                ) : qrRenderMode === 'svg' ? (
                  <div className="h-56 w-56" dangerouslySetInnerHTML={{ __html: qr }} />
                ) : (
                  <div className="text-sm text-muted-foreground">QR code indisponible.</div>
                )}
              </div>
              {totp?.secret ? (
                <div className="mt-3 text-xs text-muted-foreground">
                  Clé manuelle : <span className="font-mono">{totp.secret}</span>
                </div>
              ) : null}
            </div>
          ) : null}
        </CardContent>

        <CardFooter className="flex items-center justify-between gap-2">
          <Button variant="secondary" onClick={() => router.replace('/auth/login')}>
            Changer de compte
          </Button>
          <Button
            onClick={() => {
              const qs = factorId ? `?factorId=${encodeURIComponent(factorId)}` : '';
              router.replace(`/app/admin/mfa/verify${qs}`);
            }}
            disabled={!canContinue}
          >
            Continuer
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}


