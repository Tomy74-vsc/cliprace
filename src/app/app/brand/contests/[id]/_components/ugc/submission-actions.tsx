'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, ThumbsUp, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { ActionDialog } from '@/components/brand-ui';
import { useCsrfToken } from '@/hooks/use-csrf-token';

interface SubmissionActionsProps {
  submissionId: string;
  contestId: string;
  status: 'pending' | 'approved' | 'rejected';
  onStatusChange?: (next: 'approved' | 'rejected') => void;
}

async function postJson(path: string, body: unknown, csrfToken: string) {
  const res = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf': csrfToken,
    },
    credentials: 'include',
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export function SubmissionActions({
  submissionId,
  contestId: _contestId,
  status,
  onStatusChange,
}: SubmissionActionsProps) {
  const router = useRouter();
  const csrfToken = useCsrfToken();
  const [loading, setLoading] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const handleApprove = useCallback(async () => {
    if (!csrfToken) {
      toast.error('Missing CSRF token. Please reload the page.');
      return;
    }
    setLoading('approve');
    try {
      const { ok, data } = await postJson(
        `/api/brand/submissions/${submissionId}/approve`,
        {},
        csrfToken,
      );
      if (!ok) {
        toast.error(data?.error ?? 'Unable to approve submission.');
        return;
      }
      toast.success('Submission approved');
      onStatusChange?.('approved');
      router.refresh();
    } finally {
      setLoading(null);
    }
  }, [csrfToken, onStatusChange, router, submissionId]);

  const handleReject = useCallback(async () => {
    if (!csrfToken) {
      toast.error('Missing CSRF token. Please reload the page.');
      return;
    }
    if (rejectReason.trim().length < 10) {
      toast.error('Please provide a short reason (at least 10 characters).');
      return;
    }
    setLoading('reject');
    try {
      const { ok, data } = await postJson(
        `/api/brand/submissions/${submissionId}/reject`,
        { reason: rejectReason.trim() },
        csrfToken,
      );
      if (!ok) {
        toast.error(data?.error ?? 'Unable to reject submission.');
        return;
      }
      toast.success('Submission rejected');
      onStatusChange?.('rejected');
      setRejectOpen(false);
      setRejectReason('');
      router.refresh();
    } finally {
      setLoading(null);
    }
  }, [csrfToken, onStatusChange, rejectReason, router, submissionId]);

  const handleContact = useCallback(async () => {
    if (!csrfToken) {
      toast.error('Missing CSRF token. Please reload the page.');
      return;
    }
    setLoading('contact');
    try {
      const { ok, data } = await postJson(
        `/api/brand/submissions/${submissionId}/contact`,
        {},
        csrfToken,
      );
      if (!ok || !data?.threadId) {
        toast.error(data?.error ?? 'Unable to open conversation.');
        return;
      }
      toast.success('Thread ready');
      router.push(`/app/brand/messages?thread=${encodeURIComponent(data.threadId)}`);
    } finally {
      setLoading(null);
    }
  }, [csrfToken, router, submissionId]);

  const isPending = status === 'pending';

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {isPending && (
          <>
            <button
              type="button"
              onClick={() => void handleApprove()}
              disabled={loading !== null}
              className="inline-flex items-center gap-1 rounded-[var(--r2)] bg-[var(--accent-soft)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--accent)] hover:bg-[var(--accent-soft)]/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
              {loading === 'approve' ? 'Approving…' : 'Approve'}
            </button>
            <button
              type="button"
              onClick={() => setRejectOpen(true)}
              disabled={loading !== null}
              className="inline-flex items-center gap-1 rounded-[var(--r2)] border border-[var(--border-1)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-2)] hover:border-[var(--border-2)] hover:text-[var(--text-1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
              Reject
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => void handleContact()}
          disabled={loading === 'contact'}
          className="inline-flex items-center gap-1 rounded-[var(--r2)] border border-[var(--border-1)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-2)] hover:border-[var(--border-2)] hover:text-[var(--text-1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
          {loading === 'contact' ? 'Opening…' : 'Contact'}
        </button>
      </div>

      <ActionDialog
        open={rejectOpen}
        onOpenChange={(open) => {
          if (!open) {
            setRejectOpen(false);
            setRejectReason('');
          }
        }}
        title="Reject submission?"
        description="Explain briefly why this submission is not a fit. The creator will see this reason."
        confirmLabel={loading === 'reject' ? 'Rejecting…' : 'Reject'}
        onConfirm={() => void handleReject()}
        loading={loading === 'reject'}
        intent="danger"
      >
        <div className="mt-3">
          <label
            htmlFor={`reject-reason-${submissionId}`}
            className="block text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]"
          >
            Rejection reason
          </label>
          <textarea
            id={`reject-reason-${submissionId}`}
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            minLength={10}
            maxLength={500}
            required
            className="mt-1 h-24 w-full rounded-[var(--r2)] border border-[var(--border-1)] bg-[var(--surface-1)] px-3 py-2 text-[13px] text-[var(--text-1)] placeholder:text-[var(--text-3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            placeholder="Short, constructive explanation for the creator…"
          />
          <p className="mt-1 text-[11px] text-[var(--text-3)]">
            Minimum 10 characters. This helps creators understand how to improve.
          </p>
        </div>
      </ActionDialog>
    </>
  );
}

