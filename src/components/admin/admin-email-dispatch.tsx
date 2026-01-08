'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  AdminKeyValueEditor,
  type KeyValueEntry,
  recordFromEntries,
} from '@/components/admin/admin-key-value-editor';
import { getCsrfToken } from '@/lib/csrf-client';

type TemplateOption = {
  id: string;
  event_type: string;
  channel: string;
  subject: string | null;
  is_active: boolean;
};

interface AdminEmailDispatchProps {
  templates: TemplateOption[];
  canWrite: boolean;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseRecipients(value: string) {
  const parts = value
    .split(/[\n,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
  const recipients: Array<{ email?: string; user_id?: string }> = [];
  const invalid: string[] = [];

  for (const item of parts) {
    if (item.includes('@')) {
      recipients.push({ email: item });
    } else if (uuidPattern.test(item)) {
      recipients.push({ user_id: item });
    } else {
      invalid.push(item);
    }
  }

  return { recipients, invalid };
}

export function AdminEmailDispatch({ templates, canWrite }: AdminEmailDispatchProps) {
  const router = useRouter();
  const [mode, setMode] = useState<'manual' | 'segment'>('manual');
  const [templateId, setTemplateId] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [recipients, setRecipients] = useState('');
  const [segmentRole, setSegmentRole] = useState<'all' | 'admin' | 'brand' | 'creator'>('all');
  const [segmentLimit, setSegmentLimit] = useState(100);
  const [metadataEntries, setMetadataEntries] = useState<KeyValueEntry[]>([]);
  const [scheduleAt, setScheduleAt] = useState('');
  const [loading, setLoading] = useState(false);

  const templateOptions = useMemo(
    () => templates.filter((template) => template.channel === 'email'),
    [templates]
  );

  const send = async () => {
    if (!canWrite) return;
    setLoading(true);
    try {
      const token = await getCsrfToken();
      const metadata = recordFromEntries(metadataEntries);

      const payload: Record<string, unknown> = {
        template_id: templateId || undefined,
        subject: subject.trim() || undefined,
        body_html: bodyHtml.trim() || undefined,
        body_text: bodyText.trim() || undefined,
        metadata,
        schedule_at: scheduleAt ? new Date(scheduleAt).toISOString() : undefined,
      };

      if (mode === 'segment') {
        payload.segment = { role: segmentRole, limit: segmentLimit };
      } else {
        const parsed = parseRecipients(recipients);
        if (parsed.invalid.length > 0) {
          window.alert(`Ignored invalid recipients: ${parsed.invalid.join(', ')}`);
        }
        payload.recipients = parsed.recipients;
      }

      const res = await fetch('/api/admin/email-outbox/dispatch', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-csrf': token },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        window.alert(data?.message || 'Dispatch failed');
        return;
      }
      setRecipients('');
      setMetadataEntries([]);
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Dispatch failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft space-y-3">
      <div className="text-sm font-semibold">Manual send</div>
      {!canWrite ? (
        <div className="text-xs text-muted-foreground">Read only - requires emails.write</div>
      ) : null}
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="dispatch-mode" className="text-xs font-medium text-muted-foreground">
            Mode
          </Label>
          <select
            id="dispatch-mode"
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
            value={mode}
            onChange={(event) => setMode(event.target.value as 'manual' | 'segment')}
          >
            <option value="manual">Manual</option>
            <option value="segment">Segment</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="dispatch-template" className="text-xs font-medium text-muted-foreground">
            Template
          </Label>
          <select
            id="dispatch-template"
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
          >
            <option value="">Custom (no template)</option>
            {templateOptions.map((template) => (
              <option key={template.id} value={template.id}>
                {template.event_type} {template.is_active ? '' : '(disabled)'}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="dispatch-schedule" className="text-xs font-medium text-muted-foreground">
            Schedule
          </Label>
          <input
            id="dispatch-schedule"
            type="datetime-local"
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
            value={scheduleAt}
            onChange={(event) => setScheduleAt(event.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="text-xs font-medium text-muted-foreground">Metadata</div>
        <AdminKeyValueEditor
          entries={metadataEntries}
          onChange={setMetadataEntries}
          addLabel="Add metadata field"
          emptyLabel="No metadata fields."
        />
      </div>

      {mode === 'segment' ? (
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="segment-role" className="text-xs font-medium text-muted-foreground">
              Role
            </Label>
            <select
              id="segment-role"
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
              value={segmentRole}
              onChange={(event) => setSegmentRole(event.target.value as typeof segmentRole)}
            >
              <option value="all">All</option>
              <option value="admin">Admin</option>
              <option value="brand">Brand</option>
              <option value="creator">Creator</option>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="segment-limit" className="text-xs font-medium text-muted-foreground">
              Limit
            </Label>
            <input
              id="segment-limit"
              type="number"
              min={1}
              max={500}
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
              value={segmentLimit}
              onChange={(event) => setSegmentLimit(Number(event.target.value))}
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Label htmlFor="dispatch-recipients" className="text-xs font-medium text-muted-foreground">
            Recipients
          </Label>
          <textarea
            id="dispatch-recipients"
            className="min-h-[80px] rounded-xl border border-border bg-background px-3 py-2 text-xs font-mono"
            value={recipients}
            onChange={(event) => setRecipients(event.target.value)}
            placeholder="Emails or user IDs separated by comma or newline"
          />
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="dispatch-subject" className="text-xs font-medium text-muted-foreground">
            Subject override
          </Label>
          <input
            id="dispatch-subject"
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Subject override"
          />
        </div>
        <div className="text-xs text-muted-foreground flex items-center">
          Leave empty to use the template subject.
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="dispatch-body-text" className="text-xs font-medium text-muted-foreground">
            Body text override
          </Label>
          <textarea
            id="dispatch-body-text"
            className="min-h-[100px] rounded-xl border border-border bg-background px-3 py-2 text-xs font-mono"
            value={bodyText}
            onChange={(event) => setBodyText(event.target.value)}
            placeholder="Body text override"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="dispatch-body-html" className="text-xs font-medium text-muted-foreground">
            Body HTML override
          </Label>
          <textarea
            id="dispatch-body-html"
            className="min-h-[100px] rounded-xl border border-border bg-background px-3 py-2 text-xs font-mono"
            value={bodyHtml}
            onChange={(event) => setBodyHtml(event.target.value)}
            placeholder="Body HTML override"
          />
        </div>
      </div>
      <Button onClick={send} loading={loading} variant="primary" disabled={!canWrite || loading}>
        Dispatch
      </Button>
    </div>
  );
}
