'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { getCsrfToken } from '@/lib/csrf-client';

type ContestStatus = 'draft' | 'active' | 'paused' | 'ended' | 'archived';

interface AdminContestActionsProps {
  contestId: string;
  status: ContestStatus;
  canWrite: boolean;
}

export function AdminContestActions({ contestId, status, canWrite }: AdminContestActionsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const router = useRouter();

  const runAction = async (action: 'publish' | 'pause' | 'end' | 'archive') => {
    if (!canWrite) return;
    const labels: Record<string, string> = {
      publish: 'publish',
      pause: 'pause',
      end: 'end',
      archive: 'archive',
    };
    const confirmed = window.confirm(`Confirm: ${labels[action]} this contest?`);
    if (!confirmed) return;

    setLoading(action);
    try {
      const token = await getCsrfToken();
      const res = await fetch(`/api/admin/contests/${contestId}/${action}`, {
        method: 'POST',
        headers: { 'x-csrf': token },
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        const message = payload?.message || 'Action failed.';
        window.alert(message);
      } else {
        router.refresh();
      }
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Action failed.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {status !== 'active' && status !== 'ended' && status !== 'archived' ? (
        <Button onClick={() => runAction('publish')} disabled={!canWrite || loading !== null} variant="primary">
          {loading === 'publish' ? 'Publishing...' : 'Publish'}
        </Button>
      ) : null}
      {status === 'active' ? (
        <Button onClick={() => runAction('pause')} disabled={!canWrite || loading !== null} variant="secondary">
          {loading === 'pause' ? 'Pausing...' : 'Pause'}
        </Button>
      ) : null}
      {status === 'active' ? (
        <Button onClick={() => runAction('end')} disabled={!canWrite || loading !== null} variant="secondary">
          {loading === 'end' ? 'Ending...' : 'End'}
        </Button>
      ) : null}
      {status === 'ended' || status === 'paused' ? (
        <Button onClick={() => runAction('archive')} disabled={!canWrite || loading !== null} variant="secondary">
          {loading === 'archive' ? 'Archiving...' : 'Archive'}
        </Button>
      ) : null}
    </div>
  );
}
