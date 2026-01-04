'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminTable } from '@/components/admin/admin-table';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/formatters';

type SubmissionRow = {
  id: string;
  contest_id: string;
  creator_id: string;
  platform: string;
  external_url: string;
  title: string | null;
  thumbnail_url: string | null;
  status: string;
  rejection_reason: string | null;
  submitted_at: string;
  approved_at: string | null;
  contest: { id: string; title: string } | null;
  creator: { id: string; display_name: string | null; email: string } | null;
  metrics: { views: number; likes: number; comments: number; shares: number };
};

interface AdminSubmissionsTableProps {
  submissions: SubmissionRow[];
  canWrite: boolean;
}

function statusVariant(status: string): BadgeProps['variant'] {
  if (status === 'approved') return 'approved';
  if (status === 'rejected') return 'rejected';
  if (status === 'removed') return 'danger';
  return 'pending';
}

async function getCsrfToken(): Promise<string> {
  const res = await fetch('/api/auth/csrf');
  const data = await res.json();
  return data.token || '';
}

export function AdminSubmissionsTable({ submissions, canWrite }: AdminSubmissionsTableProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [action, setAction] = useState<'approved' | 'rejected' | 'removed'>('approved');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const pendingIds = useMemo(
    () => submissions.filter((submission) => submission.status === 'pending').map((submission) => submission.id),
    [submissions]
  );
  const allSelected = pendingIds.length > 0 && selectedIds.length === pendingIds.length;
  const totalSelected = selectedIds.length;
  const requiresReason = action === 'rejected' || action === 'removed';

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(pendingIds);
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const runBulkAction = async () => {
    if (!canWrite) return;
    if (selectedIds.length === 0) {
      window.alert('Select submissions first.');
      return;
    }
    if (requiresReason && reason.trim().length === 0) {
      window.alert('Reason required for rejection/removal.');
      return;
    }

    setLoading(true);
    try {
      const token = await getCsrfToken();
      const res = await fetch('/api/submissions/batch-moderate', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-csrf': token,
        },
        body: JSON.stringify({
          submission_ids: selectedIds,
          status: action,
          reason: requiresReason ? reason : undefined,
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        window.alert(payload?.message || 'Bulk action failed');
        return;
      }

      setSelectedIds([]);
      setReason('');
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Bulk action failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft">
        {!canWrite ? (
          <div className="w-full text-xs text-muted-foreground">
            Lecture seule — permission requise : submissions.write
          </div>
        ) : null}
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Selected</span>
          <span className="text-lg font-semibold">{totalSelected}</span>
        </div>
        <div className="text-xs text-muted-foreground">
          Only pending submissions can be moderated in bulk.
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="bulk-action" className="text-xs text-muted-foreground">
            Action
          </label>
          <select
            id="bulk-action"
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
            value={action}
            onChange={(event) => setAction(event.target.value as 'approved' | 'rejected' | 'removed')}
            disabled={!canWrite || loading}
          >
            <option value="approved">Approve</option>
            <option value="rejected">Reject</option>
            <option value="removed">Remove</option>
          </select>
        </div>
        <div className="flex flex-1 flex-col gap-1 min-w-[240px]">
          <label htmlFor="bulk-reason" className="text-xs text-muted-foreground">
            Reason
          </label>
          <input
            id="bulk-reason"
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
            placeholder={requiresReason ? 'Required for reject/remove' : 'Optional'}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={!canWrite || loading || !requiresReason}
          />
        </div>
        <Button onClick={runBulkAction} loading={loading} variant="primary" disabled={!canWrite || loading}>
          Apply
        </Button>
      </div>

      <AdminTable>
        <thead className="text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={!canWrite || loading} />
                </th>
            <th className="px-4 py-3">Preview</th>
            <th className="px-4 py-3">Submission</th>
            <th className="px-4 py-3">Contest</th>
            <th className="px-4 py-3">Creator</th>
            <th className="px-4 py-3">Metrics</th>
            <th className="px-4 py-3">Statut</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border text-sm">
          {submissions.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                Aucune soumission trouvée
              </td>
            </tr>
          ) : (
            submissions.map((submission) => (
              <tr key={submission.id} className="hover:bg-muted/30">
                <td className="px-4 py-4">
                  <input
                    type="checkbox"
                    checked={selectedSet.has(submission.id)}
                    onChange={() => toggleOne(submission.id)}
                    disabled={!canWrite || loading || submission.status !== 'pending'}
                  />
                </td>
                <td className="px-4 py-4">
                  {submission.thumbnail_url ? (
                    <img
                      src={submission.thumbnail_url}
                      alt=""
                      className="h-16 w-24 rounded-lg object-cover border border-border"
                    />
                  ) : (
                    <div className="h-16 w-24 rounded-lg border border-dashed border-border text-xs text-muted-foreground flex items-center justify-center">
                      Aucun aperçu
                    </div>
                  )}
                </td>
                <td className="px-4 py-4">
                  <div className="font-medium">{submission.title || 'Untitled'}</div>
                  <a
                    href={submission.external_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary underline"
                  >
                    Ouvrir le lien
                  </a>
                  <div className="text-xs text-muted-foreground">
                    Submitted {formatDateTime(submission.submitted_at)}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="font-medium">{submission.contest?.title || 'Unknown'}</div>
                  <div className="text-xs text-muted-foreground">{submission.contest_id}</div>
                </td>
                <td className="px-4 py-4">
                  <div className="font-medium">
                    {submission.creator?.display_name || submission.creator?.email || submission.creator_id}
                  </div>
                  <div className="text-xs text-muted-foreground">{submission.creator_id}</div>
                </td>
                <td className="px-4 py-4 text-xs">
                  <div>Views: {submission.metrics.views.toLocaleString()}</div>
                  <div>Likes: {submission.metrics.likes.toLocaleString()}</div>
                  <div>Comments: {submission.metrics.comments.toLocaleString()}</div>
                  <div>Shares: {submission.metrics.shares.toLocaleString()}</div>
                </td>
                <td className="px-4 py-4">
                  <Badge variant={statusVariant(submission.status)}>{submission.status}</Badge>
                  {submission.rejection_reason ? (
                    <div className="text-xs text-muted-foreground mt-1">{submission.rejection_reason}</div>
                  ) : null}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </AdminTable>
    </div>
  );
}
