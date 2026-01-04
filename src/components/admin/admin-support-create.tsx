'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

const STATUSES = ['open', 'pending', 'resolved', 'closed'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

async function getCsrfToken(): Promise<string> {
  const res = await fetch('/api/auth/csrf');
  const data = await res.json();
  return data.token || '';
}

export function AdminSupportCreate({ canWrite }: { canWrite: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState('');
  const [email, setEmail] = useState('');
  const [userId, setUserId] = useState('');
  const [priority, setPriority] = useState('medium');
  const [status, setStatus] = useState('open');
  const [assignedTo, setAssignedTo] = useState('');
  const [notes, setNotes] = useState('');

  const createTicket = async () => {
    if (!canWrite) return;
    if (subject.trim().length < 3) {
      window.alert('Subject is required.');
      return;
    }
    if (!email.trim() && !userId.trim()) {
      window.alert('Provide email or user id.');
      return;
    }
    setLoading(true);
    try {
      const token = await getCsrfToken();
      const payload = {
        subject: subject.trim(),
        email: email.trim() || undefined,
        user_id: userId.trim() || undefined,
        priority,
        status,
        assigned_to: assignedTo.trim() || null,
        internal_notes: notes.trim() || null,
      };
      const res = await fetch('/api/admin/support/tickets', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-csrf': token },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        window.alert(data?.message || 'Create failed');
        return;
      }
      setSubject('');
      setEmail('');
      setUserId('');
      setPriority('medium');
      setStatus('open');
      setAssignedTo('');
      setNotes('');
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Create failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft space-y-3">
      <div className="text-sm font-semibold">Create ticket</div>
      {!canWrite ? (
        <div className="text-xs text-muted-foreground">Lecture seule — permission requise : support.write</div>
      ) : null}
      <div className="grid gap-3 lg:grid-cols-3">
        <input
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
          placeholder="Subject"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          disabled={!canWrite || loading}
        />
        <input
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
          placeholder="Requester email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={!canWrite || loading}
        />
        <input
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
          placeholder="Requester user id"
          value={userId}
          onChange={(event) => setUserId(event.target.value)}
          disabled={!canWrite || loading}
        />
      </div>
      <div className="grid gap-3 lg:grid-cols-4">
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
        <select
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
          value={priority}
          onChange={(event) => setPriority(event.target.value)}
          disabled={!canWrite || loading}
        >
          {PRIORITIES.map((value) => (
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
      <textarea
        className="min-h-[100px] rounded-xl border border-border bg-background px-3 py-2 text-xs font-mono"
        placeholder="Internal notes"
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        disabled={!canWrite || loading}
      />
      <Button onClick={createTicket} loading={loading} variant="primary" disabled={!canWrite || loading}>
        Create ticket
      </Button>
    </div>
  );
}
