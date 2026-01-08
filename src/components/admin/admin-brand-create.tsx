'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { getCsrfToken } from '@/lib/csrf-client';

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
        `Brand created.\nInvite: ${data.invite_sent ? 'sent' : 'not sent'}\nCreate contest: ${contestHref}`
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
      <div className="text-sm font-semibold">Create brand</div>
      {!canWrite ? (
        <div className="text-xs text-muted-foreground">Read only - requires brands.write</div>
      ) : null}
      <div className="grid gap-3 lg:grid-cols-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="brand-email" className="text-xs font-medium text-muted-foreground">
            Brand email
          </label>
          <input
            id="brand-email"
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
            placeholder="owner@brand.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={!canWrite || loading}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="brand-company" className="text-xs font-medium text-muted-foreground">
            Company name
          </label>
          <input
            id="brand-company"
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
            placeholder="Acme Studios"
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            disabled={!canWrite || loading}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="brand-org" className="text-xs font-medium text-muted-foreground">
            Organization name
          </label>
          <input
            id="brand-org"
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
            placeholder="Optional org name"
            value={orgName}
            onChange={(event) => setOrgName(event.target.value)}
            disabled={!canWrite || loading}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="brand-billing" className="text-xs font-medium text-muted-foreground">
            Billing email
          </label>
          <input
            id="brand-billing"
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
            placeholder="billing@brand.com"
            value={billingEmail}
            onChange={(event) => setBillingEmail(event.target.value)}
            disabled={!canWrite || loading}
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={sendInvite}
          onChange={(event) => setSendInvite(event.target.checked)}
          disabled={!canWrite || loading}
        />
        Send Supabase invite email
      </label>
      <Button onClick={createBrand} loading={loading} disabled={!canWrite || !canSubmit} variant="primary">
        Create brand + org + owner
      </Button>
    </div>
  );
}
