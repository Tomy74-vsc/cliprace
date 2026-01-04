'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useCsrfToken } from '@/hooks/use-csrf-token';

interface AdminUserActionsProps {
  userId: string;
  role: 'admin' | 'brand' | 'creator';
  isActive: boolean;
  canWrite?: boolean;
}

export function AdminUserActions({ userId, role, isActive, canWrite = true }: AdminUserActionsProps) {
  const router = useRouter();
  const csrfToken = useCsrfToken();
  const [loading, setLoading] = useState(false);
  const [nextRole, setNextRole] = useState(role);
  const [impersonationOpen, setImpersonationOpen] = useState(false);
  const [impersonationLink, setImpersonationLink] = useState<string | null>(null);

  useEffect(() => {
    setNextRole(role);
  }, [role]);

  const updateUser = async (payload: Record<string, unknown>) => {
    if (!canWrite) {
      window.alert("Accès en lecture seule : impossible de modifier l'utilisateur.");
      return;
    }
    setLoading(true);
    try {
      if (!csrfToken) {
        window.alert('Token CSRF manquant. Rafraîchis la page.');
        return;
      }
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'x-csrf': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        window.alert(data?.message || 'Mise à jour impossible');
        return;
      }
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Mise à jour impossible');
    } finally {
      setLoading(false);
    }
  };

  const resetOnboarding = async () => {
    if (!canWrite) {
      window.alert("Accès en lecture seule : impossible de modifier l'utilisateur.");
      return;
    }
    setLoading(true);
    try {
      if (!csrfToken) {
        window.alert('Token CSRF manquant. Rafraîchis la page.');
        return;
      }
      const res = await fetch(`/api/admin/users/${userId}/reset-onboarding`, {
        method: 'POST',
        headers: { 'x-csrf': csrfToken },
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        window.alert(data?.message || "Impossible de réinitialiser l'onboarding");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  const createImpersonationLink = async () => {
    if (!canWrite) {
      window.alert("Accès en lecture seule : impossible de modifier l'utilisateur.");
      return;
    }
    setLoading(true);
    try {
      if (!csrfToken) {
        window.alert('Token CSRF manquant. Rafraîchis la page.');
        return;
      }
      const res = await fetch(`/api/admin/users/${userId}/impersonate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-csrf': csrfToken },
        credentials: 'include',
        body: JSON.stringify({ next: '/app' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok || !data.action_link) {
        window.alert(data?.message || "Impossible de générer le lien d'impersonation");
        return;
      }
      setImpersonationLink(data.action_link);
      setImpersonationOpen(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-2">
          <label className="text-xs text-muted-foreground" htmlFor="role">
            Rôle
          </label>
        <select
          id="role"
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
          value={nextRole}
          onChange={(event) => setNextRole(event.target.value as 'admin' | 'brand' | 'creator')}
        >
            <option value="admin">admin</option>
            <option value="brand">brand</option>
            <option value="creator">creator</option>
        </select>
      </div>
      <Button
        variant="secondary"
        onClick={() => updateUser({ role: nextRole })}
        loading={loading}
        disabled={!canWrite || nextRole === role}
      >
          Mettre à jour le rôle
      </Button>
      <Button
        variant={isActive ? 'destructive' : 'primary'}
        onClick={() => updateUser({ is_active: !isActive })}
        loading={loading}
        disabled={!canWrite}
      >
          {isActive ? 'Suspendre' : 'Activer'}
      </Button>
        <Button variant="secondary" onClick={resetOnboarding} loading={loading} disabled={!canWrite}>
          Réinitialiser l'onboarding
        </Button>
        <Button variant="secondary" onClick={createImpersonationLink} loading={loading} disabled={!canWrite}>
          Lien d'impersonation
        </Button>
    </div>

      <Dialog open={impersonationOpen} onOpenChange={setImpersonationOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Lien d'impersonation</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              label="Lien"
              value={impersonationLink ?? ''}
              readOnly
              onFocus={(e) => e.currentTarget.select()}
            />
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                onClick={async () => {
                  if (!impersonationLink) return;
                  await navigator.clipboard.writeText(impersonationLink).catch(() => void 0);
                }}
              >
                Copier
              </Button>
              <Button
                onClick={() => {
                  if (!impersonationLink) return;
                  window.open(impersonationLink, '_blank', 'noopener,noreferrer');
                }}
              >
                Ouvrir
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Ouvre le lien dans une fenêtre privée pour ne pas perdre ta session admin.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
