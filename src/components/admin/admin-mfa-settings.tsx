'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { AdminActionPanel } from '@/components/admin/admin-action-panel';
import { useToastContext } from '@/hooks/use-toast-context';
import { supabase } from '@/lib/supabase/client';

type MfaStatusResponse = {
  enrolled: boolean;
  currentLevel: string;
};

export function AdminMfaSettings({ canWrite }: { canWrite: boolean }) {
  const { toast } = useToastContext();
  const [status, setStatus] = useState<MfaStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) throw factorsError;
      const hasTotp = Boolean((factors?.totp ?? []).length > 0);

      const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalError || !aal) throw aalError ?? new Error('Impossible de charger le niveau AAL.');

      setStatus({ enrolled: hasTotp, currentLevel: aal.currentLevel ?? 'unknown' });
    } catch (e) {
      toast({ type: 'error', title: 'Erreur', message: e instanceof Error ? e.message : 'Erreur inconnue' });
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const disable = async () => {
    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
    if (factorsError) throw factorsError;
    const factorId = (factors?.totp ?? [])[0]?.id ?? '';
    if (!factorId) throw new Error('Aucun facteur TOTP trouvé.');

    const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId });
    if (unenrollError) throw unenrollError;
  };

  if (loading) return <div className="text-sm text-muted-foreground">Chargement…</div>;
  if (!status) return <div className="text-sm text-muted-foreground">Statut indisponible.</div>;

  return (
    <div className="space-y-3">
      <div className="text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Requise</span>
          <span className="font-medium">Oui (admin)</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Enrôlée</span>
          <span className="font-medium">{status.enrolled ? 'Oui' : 'Non'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Niveau (session)</span>
          <span className="font-medium">{status.currentLevel === 'aal2' ? 'AAL2' : status.currentLevel}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="secondary" size="sm">
          <Link href="/app/admin/mfa/setup">Configurer / vérifier</Link>
        </Button>
        <Button variant="secondary" size="sm" onClick={() => void refresh()}>
          Actualiser
        </Button>

        {status.enrolled && canWrite ? (
          <AdminActionPanel
            trigger={
              <Button size="sm" variant="destructive">
                Désactiver
              </Button>
            }
            title="Désactiver la MFA"
            description="Réduit la sécurité. Recommandé uniquement en cas de perte d’accès à l’authenticator."
            requiresReason
            reasonLabel="Raison"
            reasonPlaceholder="Explique pourquoi tu désactives la MFA (min 8 caractères)…"
            confirmLabel="Désactiver"
            confirmVariant="destructive"
            onConfirm={async ({ reason }) => {
              try {
                // Reason is only for audit/UX; Supabase unenroll doesn't accept it.
                void reason;
                await disable();
                toast({ type: 'success', title: 'OK', message: 'MFA désactivée.' });
                await refresh();
              } catch (e) {
                toast({ type: 'error', title: 'Erreur', message: e instanceof Error ? e.message : 'Erreur inconnue' });
              }
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

