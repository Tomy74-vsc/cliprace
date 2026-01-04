'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

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

async function getCsrfToken(): Promise<string> {
  const res = await fetch('/api/auth/csrf');
  const data = await res.json();
  return data.token || '';
}

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

function parseMetadata(value: string) {
  if (!value.trim()) return { ok: true, value: {} as Record<string, unknown> };
  try {
    return { ok: true, value: JSON.parse(value) as Record<string, unknown> };
  } catch (error) {
    return { ok: false, error };
  }
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
  const [metadata, setMetadata] = useState('{}');
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
      const parsedMetadata = parseMetadata(metadata);
      if (!parsedMetadata.ok) {
        window.alert('Invalid JSON metadata.');
        return;
      }

      const payload: Record<string, unknown> = {
        template_id: templateId || undefined,
        subject: subject.trim() || undefined,
        body_html: bodyHtml.trim() || undefined,
        body_text: bodyText.trim() || undefined,
        metadata: parsedMetadata.value,
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
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Dispatch failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft space-y-3">
      <div className="text-sm font-semibold">Manual send / campaign</div>
      {!canWrite ? (
        <div className="text-xs text-muted-foreground">Lecture seule — permission requise : emails.write</div>
      ) : null}
      <div className="grid gap-3 lg:grid-cols-4">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-muted-foreground">Mode</label>
          <select
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
            value={mode}
            onChange={(event) => setMode(event.target.value as 'manual' | 'segment')}
          >
            <option value="manual">Manual</option>
            <option value="segment">Campaign</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-muted-foreground">Template</label>
          <select
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
          <label className="text-xs font-medium text-muted-foreground">Schedule</label>
          <input
            type="datetime-local"
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
            value={scheduleAt}
            onChange={(event) => setScheduleAt(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-muted-foreground">Metadata (JSON)</label>
          <input
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm font-mono"
            value={metadata}
            onChange={(event) => setMetadata(event.target.value)}
          />
        </div>
      </div>

      {mode === 'segment' ? (
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-muted-foreground">Rôle</label>
            <select
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
              value={segmentRole}
              onChange={(event) => setSegmentRole(event.target.value as typeof segmentRole)}
            >
              <option value="all">Tous</option>
              <option value="admin">Admin</option>
              <option value="brand">Marque</option>
              <option value="creator">Créateur</option>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-muted-foreground">Limit</label>
            <input
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
          <label className="text-xs font-medium text-muted-foreground">Recipients</label>
          <textarea
            className="min-h-[80px] rounded-xl border border-border bg-background px-3 py-2 text-xs font-mono"
            value={recipients}
            onChange={(event) => setRecipients(event.target.value)}
            placeholder="Emails or user IDs separated by comma or newline"
          />
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <input
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
          placeholder="Subject override"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
        />
        <div className="text-xs text-muted-foreground flex items-center">
          Leave empty to use template subject.
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <textarea
          className="min-h-[100px] rounded-xl border border-border bg-background px-3 py-2 text-xs font-mono"
          value={bodyText}
          onChange={(event) => setBodyText(event.target.value)}
          placeholder="Body text override"
        />
        <textarea
          className="min-h-[100px] rounded-xl border border-border bg-background px-3 py-2 text-xs font-mono"
          value={bodyHtml}
          onChange={(event) => setBodyHtml(event.target.value)}
          placeholder="Body HTML override"
        />
      </div>
      <Button onClick={send} loading={loading} variant="primary" disabled={!canWrite || loading}>
        Dispatch
      </Button>
    </div>
  );
}
