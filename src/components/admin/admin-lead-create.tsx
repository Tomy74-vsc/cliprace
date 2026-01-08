'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { getCsrfToken } from '@/lib/csrf-client';

const STATUSES = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'];

export function AdminLeadCreate({ canWrite }: { canWrite: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [source, setSource] = useState('');
  const [value, setValue] = useState('');
  const [status, setStatus] = useState('new');
  const [assignedTo, setAssignedTo] = useState('');

  const createLead = async () => {
    if (!canWrite) return;
    if (name.trim().length < 2) {
      window.alert('Name is required.');
      return;
    }
    setLoading(true);
    try {
      const token = await getCsrfToken();
      const valueCents = value ? Math.round(Number(value) * 100) : undefined;
      const payload = {
        name: name.trim(),
        email: email.trim() || null,
        company: company.trim() || null,
        source: source.trim() || null,
        status,
        value_cents: Number.isFinite(valueCents) ? valueCents : undefined,
        assigned_to: assignedTo.trim() || null,
      };
      const res = await fetch('/api/admin/crm/leads', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-csrf': token },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        window.alert(data?.message || 'Create failed');
        return;
      }
      setName('');
      setEmail('');
      setCompany('');
      setSource('');
      setValue('');
      setStatus('new');
      setAssignedTo('');
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Create failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft space-y-3">
      <div className="text-sm font-semibold">Create lead</div>
      {!canWrite ? (
        <div className="text-xs text-muted-foreground">Read only - requires crm.write</div>
      ) : null}
      <div className="grid gap-3 lg:grid-cols-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="lead-name" className="text-xs font-medium text-muted-foreground">
            Lead name
          </label>
          <input
            id="lead-name"
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
            placeholder="Lead name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={!canWrite || loading}
            aria-required="true"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="lead-email" className="text-xs font-medium text-muted-foreground">
            Lead email
          </label>
          <input
            id="lead-email"
            type="email"
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
            placeholder="lead@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={!canWrite || loading}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="lead-company" className="text-xs font-medium text-muted-foreground">
            Company
          </label>
          <input
            id="lead-company"
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
            placeholder="Company name"
            value={company}
            onChange={(event) => setCompany(event.target.value)}
            disabled={!canWrite || loading}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="lead-source" className="text-xs font-medium text-muted-foreground">
            Source
          </label>
          <input
            id="lead-source"
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
            placeholder="Inbound, referral, outbound"
            value={source}
            onChange={(event) => setSource(event.target.value)}
            disabled={!canWrite || loading}
          />
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="lead-value" className="text-xs font-medium text-muted-foreground">
            Value (EUR)
          </label>
          <input
            id="lead-value"
            type="number"
            min={0}
            step="0.01"
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
            placeholder="Value (EUR)"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            disabled={!canWrite || loading}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="lead-status" className="text-xs font-medium text-muted-foreground">
            Status
          </label>
          <select
            id="lead-status"
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            disabled={!canWrite || loading}
            aria-label="Lead status"
          >
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="lead-assigned" className="text-xs font-medium text-muted-foreground">
            Assigned to (admin id)
          </label>
          <input
            id="lead-assigned"
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
            placeholder="Assigned admin id"
            value={assignedTo}
            onChange={(event) => setAssignedTo(event.target.value)}
            disabled={!canWrite || loading}
          />
        </div>
      </div>
      <Button onClick={createLead} loading={loading} variant="primary" disabled={!canWrite || loading}>
        Create lead
      </Button>
    </div>
  );
}
