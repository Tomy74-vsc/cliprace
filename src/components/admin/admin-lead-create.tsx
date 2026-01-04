'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

const STATUSES = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'];

async function getCsrfToken(): Promise<string> {
  const res = await fetch('/api/auth/csrf');
  const data = await res.json();
  return data.token || '';
}

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
        <div className="text-xs text-muted-foreground">Lecture seule — permission requise : crm.write</div>
      ) : null}
      <div className="grid gap-3 lg:grid-cols-4">
        <input
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
          placeholder="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={!canWrite || loading}
        />
        <input
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={!canWrite || loading}
        />
        <input
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
          placeholder="Company"
          value={company}
          onChange={(event) => setCompany(event.target.value)}
          disabled={!canWrite || loading}
        />
        <input
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
          placeholder="Source"
          value={source}
          onChange={(event) => setSource(event.target.value)}
          disabled={!canWrite || loading}
        />
      </div>
      <div className="grid gap-3 lg:grid-cols-4">
        <input
          type="number"
          min={0}
          step="0.01"
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
          placeholder="Value (EUR)"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={!canWrite || loading}
        />
        <select
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          disabled={!canWrite || loading}
        >
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <input
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
          placeholder="Assigned admin id"
          value={assignedTo}
          onChange={(event) => setAssignedTo(event.target.value)}
          disabled={!canWrite || loading}
        />
      </div>
      <Button onClick={createLead} loading={loading} variant="primary" disabled={!canWrite || loading}>
        Create lead
      </Button>
    </div>
  );
}
