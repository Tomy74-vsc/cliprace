'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

const STATUSES = ['open', 'pending', 'resolved', 'closed'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

interface AdminSupportActionsProps {
  ticketId: string;
  status: string;
  priority: string;
  assignedToId: string | null;
  canWrite: boolean;
}

async function getCsrfToken(): Promise<string> {
  const res = await fetch('/api/auth/csrf');
  const data = await res.json();
  return data.token || '';
}

export function AdminSupportActions({
  ticketId,
  status,
  priority,
  assignedToId,
  canWrite,
}: AdminSupportActionsProps) {
  const router = useRouter();
  const [selectedStatus, setSelectedStatus] = useState(status);
  const [selectedPriority, setSelectedPriority] = useState(priority);
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    setSelectedStatus(status);
  }, [status]);

  useEffect(() => {
    setSelectedPriority(priority);
  }, [priority]);

  const runUpdate = async (payload: Record<string, unknown>, action: string) => {
    if (!canWrite) return;
    setLoading(action);
    try {
      const token = await getCsrfToken();
      const res = await fetch(`/api/admin/support/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-csrf': token },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        window.alert(data?.message || 'Update failed');
        return;
      }
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Update failed');
    } finally {
      setLoading(null);
    }
  };

  const addNote = async () => {
    if (!canWrite) return;
    const note = window.prompt('Add note');
    if (!note || note.trim().length < 2) return;
    setLoading('note');
    try {
      const token = await getCsrfToken();
      const res = await fetch(`/api/admin/support/tickets/${ticketId}/notes`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-csrf': token },
        body: JSON.stringify({ note }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        window.alert(data?.message || 'Note failed');
        return;
      }
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Note failed');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {!canWrite ? <div className="text-xs text-muted-foreground">Lecture seule</div> : null}
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="h-9 rounded-lg border border-border bg-background px-2 text-xs"
          value={selectedStatus}
          onChange={(event) => setSelectedStatus(event.target.value)}
          disabled={!canWrite || loading !== null}
        >
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-lg border border-border bg-background px-2 text-xs"
          value={selectedPriority}
          onChange={(event) => setSelectedPriority(event.target.value)}
          disabled={!canWrite || loading !== null}
        >
          {PRIORITIES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          variant="secondary"
          loading={loading === 'update'}
          onClick={() => runUpdate({ status: selectedStatus, priority: selectedPriority }, 'update')}
          disabled={!canWrite || loading !== null}
        >
          Update
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          loading={loading === 'assign'}
          onClick={() => runUpdate({ assign_to_me: true }, 'assign')}
          disabled={!canWrite || loading !== null}
        >
          Assign me
        </Button>
        {assignedToId ? (
          <Button
            size="sm"
            variant="ghost"
            loading={loading === 'clear'}
            onClick={() => runUpdate({ assigned_to: null }, 'clear')}
            disabled={!canWrite || loading !== null}
          >
            Clear
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="ghost"
          loading={loading === 'note'}
          onClick={addNote}
          disabled={!canWrite || loading !== null}
        >
          Add note
        </Button>
      </div>
    </div>
  );
}
