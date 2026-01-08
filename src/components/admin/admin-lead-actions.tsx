'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { getCsrfToken } from '@/lib/csrf-client';

const STATUSES = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'];

interface AdminLeadActionsProps {
  leadId: string;
  status: string;
  assignedToId: string | null;
  canWrite: boolean;
}

export function AdminLeadActions({ leadId, status, assignedToId, canWrite }: AdminLeadActionsProps) {
  const router = useRouter();
  const [selectedStatus, setSelectedStatus] = useState(status);
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    setSelectedStatus(status);
  }, [status]);

  const runUpdate = async (payload: Record<string, unknown>, action: string) => {
    if (!canWrite) return;
    setLoading(action);
    try {
      const token = await getCsrfToken();
      const res = await fetch(`/api/admin/crm/leads/${leadId}`, {
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

  const assignToMe = () => runUpdate({ assign_to_me: true }, 'assign');
  const clearAssign = () => runUpdate({ assigned_to: null }, 'clear');
  const updateStatus = () => runUpdate({ status: selectedStatus }, 'status');

  return (
    <div className="flex flex-col gap-2">
      {!canWrite ? <div className="text-xs text-muted-foreground">Read only</div> : null}
      <div className="flex items-center gap-2">
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
        <Button
          size="sm"
          variant="secondary"
          loading={loading === 'status'}
          onClick={updateStatus}
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
          onClick={assignToMe}
          disabled={!canWrite || loading !== null}
        >
          Assign me
        </Button>
        {assignedToId ? (
          <Button
            size="sm"
            variant="ghost"
            loading={loading === 'clear'}
            onClick={clearAssign}
            disabled={!canWrite || loading !== null}
          >
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  );
}
