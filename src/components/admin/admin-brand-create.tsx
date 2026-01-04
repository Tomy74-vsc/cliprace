'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

async function getCsrfToken(): Promise<string> {
  const res = await fetch('/api/auth/csrf');
  const data = await res.json().catch(() => ({}));
  return data.token || '';
}

export function AdminBrandCreate({ canWrite }: { canWrite: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [billingEmail, setBillingEmail] = useState('');
  const [sendInvite, setSendInvite] = useState(true);

  const canSubmit = useMemo(() => {
    return email.trim().length > 3 && companyName.trim().length >= 2;
  }, [email, companyName]);

  const createBrand = async () => {
    if (!canWrite) return;
    if (!canSubmit) return;
    setLoading(true);
    try {
      const token = await getCsrfToken();
      const payload = {
        email: email.trim(),
        company_name: companyName.trim(),
        org_name: orgName.trim() || undefined,
        billing_email: billingEmail.trim() || undefined,
        send_invite: sendInvite,
      };

      const res = await fetch('/api/admin/brands', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-csrf': token },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        window.alert(data?.message || 'Create brand failed');
        return;
      }

      setEmail('');
      setCompanyName('');
      setOrgName('');
      setBillingEmail('');

      const contestHref = `/app/admin/contests/new?brand_id=${encodeURIComponent(data.brand_id)}`;
      window.alert(
        `Marque créée.\nInvite: ${data.invite_sent ? 'envoyée' : 'non envoyée'}\nCréer un concours: ${contestHref}`
      );
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Create brand failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft space-y-3">
      <div className="text-sm font-semibold">Créer une marque</div>
      {!canWrite ? (
        <div className="text-xs text-muted-foreground">Lecture seule — permission requise : brands.write</div>
      ) : null}
      <div className="grid gap-3 lg:grid-cols-4">
        <input
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
          placeholder="Email (compte Supabase)"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={!canWrite || loading}
        />
        <input
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
          placeholder="Nom de l'entreprise"
          value={companyName}
          onChange={(event) => setCompanyName(event.target.value)}
          disabled={!canWrite || loading}
        />
        <input
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
          placeholder="Nom d'org (optionnel)"
          value={orgName}
          onChange={(event) => setOrgName(event.target.value)}
          disabled={!canWrite || loading}
        />
        <input
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
          placeholder="Billing email (optionnel)"
          value={billingEmail}
          onChange={(event) => setBillingEmail(event.target.value)}
          disabled={!canWrite || loading}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={sendInvite}
          onChange={(event) => setSendInvite(event.target.checked)}
          disabled={!canWrite || loading}
        />
        Envoyer une invitation Supabase par email
      </label>
      <Button onClick={createBrand} loading={loading} disabled={!canWrite || !canSubmit} variant="primary">
        Créer marque + org + owner
      </Button>
    </div>
  );
}
