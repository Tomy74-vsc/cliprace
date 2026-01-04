'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminTable } from '@/components/admin/admin-table';
import { Button } from '@/components/ui/button';

type Template = {
  id: string;
  event_type: string;
  channel: string;
  subject: string | null;
  body_html: string | null;
  body_text: string | null;
  variables: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

interface AdminNotificationTemplatesProps {
  templates: Template[];
  canWrite: boolean;
}

const CHANNELS = ['email', 'push', 'inapp', 'sms'];

async function getCsrfToken(): Promise<string> {
  const res = await fetch('/api/auth/csrf');
  const data = await res.json();
  return data.token || '';
}

function toJsonString(value: Record<string, unknown>) {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return '{}';
  }
}

function truncate(value: string | null, length = 120) {
  if (!value) return '-';
  if (value.length <= length) return value;
  return `${value.slice(0, length)}...`;
}

export function AdminNotificationTemplates({ templates, canWrite }: AdminNotificationTemplatesProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [eventType, setEventType] = useState('');
  const [channel, setChannel] = useState('email');
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [variables, setVariables] = useState('{}');
  const [isActive, setIsActive] = useState(true);

  const editingTemplate = useMemo(
    () => templates.find((template) => template.id === editingId) ?? null,
    [templates, editingId]
  );
  const [editEventType, setEditEventType] = useState('');
  const [editChannel, setEditChannel] = useState('email');
  const [editSubject, setEditSubject] = useState('');
  const [editBodyHtml, setEditBodyHtml] = useState('');
  const [editBodyText, setEditBodyText] = useState('');
  const [editVariables, setEditVariables] = useState('{}');
  const [editIsActive, setEditIsActive] = useState(true);

  const resetCreate = () => {
    setEventType('');
    setChannel('email');
    setSubject('');
    setBodyHtml('');
    setBodyText('');
    setVariables('{}');
    setIsActive(true);
  };

  const startEdit = (template: Template) => {
    if (!canWrite) return;
    setEditingId(template.id);
    setEditEventType(template.event_type);
    setEditChannel(template.channel);
    setEditSubject(template.subject ?? '');
    setEditBodyHtml(template.body_html ?? '');
    setEditBodyText(template.body_text ?? '');
    setEditVariables(toJsonString(template.variables));
    setEditIsActive(template.is_active);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const parseVariables = (value: string) => {
    if (!value.trim()) return { ok: true, value: {} as Record<string, unknown> };
    try {
      return { ok: true, value: JSON.parse(value) as Record<string, unknown> };
    } catch (error) {
      return { ok: false, error };
    }
  };

  const createTemplate = async () => {
    if (!canWrite) return;
    setLoading(true);
    try {
      const token = await getCsrfToken();
      const parsedVars = parseVariables(variables);
      if (!parsedVars.ok) {
        window.alert('Invalid JSON variables.');
        return;
      }
      const payload = {
        event_type: eventType.trim(),
        channel,
        subject: subject.trim() || null,
        body_html: bodyHtml.trim() || null,
        body_text: bodyText.trim() || null,
        variables: parsedVars.value,
        is_active: isActive,
      };
      const res = await fetch('/api/admin/notification-templates', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-csrf': token },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        window.alert(data?.message || 'Create failed');
        return;
      }
      resetCreate();
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Create failed');
    } finally {
      setLoading(false);
    }
  };

  const saveTemplate = async () => {
    if (!canWrite) return;
    if (!editingTemplate) return;
    setLoading(true);
    try {
      const token = await getCsrfToken();
      const parsedVars = parseVariables(editVariables);
      if (!parsedVars.ok) {
        window.alert('Invalid JSON variables.');
        return;
      }
      const payload = {
        event_type: editEventType.trim(),
        channel: editChannel,
        subject: editSubject.trim() || null,
        body_html: editBodyHtml.trim() || null,
        body_text: editBodyText.trim() || null,
        variables: parsedVars.value,
        is_active: editIsActive,
      };
      const res = await fetch(`/api/admin/notification-templates/${editingTemplate.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-csrf': token },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        window.alert(data?.message || 'Update failed');
        return;
      }
      setEditingId(null);
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  const toggleTemplate = async (template: Template) => {
    if (!canWrite) return;
    setLoading(true);
    try {
      const token = await getCsrfToken();
      const res = await fetch(`/api/admin/notification-templates/${template.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-csrf': token },
        body: JSON.stringify({ is_active: !template.is_active }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        window.alert(data?.message || 'Toggle failed');
        return;
      }
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Toggle failed');
    } finally {
      setLoading(false);
    }
  };

  const deleteTemplate = async (template: Template) => {
    if (!canWrite) return;
    const ok = window.confirm('Delete this template?');
    if (!ok) return;
    setLoading(true);
    try {
      const token = await getCsrfToken();
      const res = await fetch(`/api/admin/notification-templates/${template.id}`, {
        method: 'DELETE',
        headers: { 'x-csrf': token },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        window.alert(data?.message || 'Delete failed');
        return;
      }
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Delete failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {!canWrite ? <div className="text-xs text-muted-foreground">Lecture seule — permission requise : emails.write</div> : null}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft space-y-3">
        <div className="text-sm font-semibold">Create template</div>
        <div className="grid gap-3 lg:grid-cols-4">
          <input
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
            placeholder="Event type"
            value={eventType}
            onChange={(event) => setEventType(event.target.value)}
          />
          <select
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
            value={channel}
            onChange={(event) => setChannel(event.target.value)}
          >
            {CHANNELS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <input
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
            placeholder="Subject"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
          />
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
            />
            Actif
          </label>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <textarea
            className="min-h-[120px] rounded-xl border border-border bg-background px-3 py-2 text-xs font-mono"
            value={bodyText}
            onChange={(event) => setBodyText(event.target.value)}
            placeholder="Body text"
          />
          <textarea
            className="min-h-[120px] rounded-xl border border-border bg-background px-3 py-2 text-xs font-mono"
            value={bodyHtml}
            onChange={(event) => setBodyHtml(event.target.value)}
            placeholder="Body HTML"
          />
        </div>
        <textarea
          className="min-h-[100px] rounded-xl border border-border bg-background px-3 py-2 text-xs font-mono"
          value={variables}
          onChange={(event) => setVariables(event.target.value)}
          placeholder='{"variable":"description"}'
        />
        <Button onClick={createTemplate} loading={loading} variant="primary" disabled={!canWrite || loading}>
          Create template
        </Button>
      </div>

      <AdminTable>
        <thead className="text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Event</th>
            <th className="px-4 py-3">Channel</th>
            <th className="px-4 py-3">Subject</th>
            <th className="px-4 py-3">Body</th>
            <th className="px-4 py-3">Actif</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border text-sm">
          {templates.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                Aucun template configuré
              </td>
            </tr>
          ) : (
            templates.map((template) => (
              <tr key={template.id} className="hover:bg-muted/30">
                <td className="px-4 py-4">
                  {editingId === template.id ? (
                    <input
                      className="h-9 rounded-lg border border-border bg-background px-2 text-sm w-full"
                      value={editEventType}
                      onChange={(event) => setEditEventType(event.target.value)}
                    />
                  ) : (
                    <div className="font-medium">{template.event_type}</div>
                  )}
                  <div className="text-xs text-muted-foreground">{template.id}</div>
                </td>
                <td className="px-4 py-4">
                  {editingId === template.id ? (
                    <select
                      className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
                      value={editChannel}
                      onChange={(event) => setEditChannel(event.target.value)}
                    >
                      {CHANNELS.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span>{template.channel}</span>
                  )}
                </td>
                <td className="px-4 py-4">
                  {editingId === template.id ? (
                    <input
                      className="h-9 rounded-lg border border-border bg-background px-2 text-sm w-full"
                      value={editSubject}
                      onChange={(event) => setEditSubject(event.target.value)}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {template.subject || '-'}
                    </span>
                  )}
                </td>
                <td className="px-4 py-4">
                  {editingId === template.id ? (
                    <div className="space-y-2">
                      <textarea
                        className="min-h-[70px] w-full rounded-lg border border-border bg-background px-2 py-1 text-xs font-mono"
                        value={editBodyText}
                        onChange={(event) => setEditBodyText(event.target.value)}
                      />
                      <textarea
                        className="min-h-[70px] w-full rounded-lg border border-border bg-background px-2 py-1 text-xs font-mono"
                        value={editBodyHtml}
                        onChange={(event) => setEditBodyHtml(event.target.value)}
                      />
                      <textarea
                        className="min-h-[70px] w-full rounded-lg border border-border bg-background px-2 py-1 text-xs font-mono"
                        value={editVariables}
                        onChange={(event) => setEditVariables(event.target.value)}
                      />
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div>{truncate(template.body_text || template.body_html)}</div>
                      <div className="text-[11px]">{truncate(toJsonString(template.variables), 80)}</div>
                    </div>
                  )}
                </td>
                <td className="px-4 py-4">
                  {editingId === template.id ? (
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={editIsActive}
                        onChange={(event) => setEditIsActive(event.target.checked)}
                      />
                      Actif
                    </label>
                  ) : (
                    <span className="text-xs text-muted-foreground">{template.is_active ? 'yes' : 'no'}</span>
                  )}
                </td>
                <td className="px-4 py-4 space-y-2">
                  {editingId === template.id ? (
                    <>
                      <Button onClick={saveTemplate} loading={loading} size="sm" variant="primary" disabled={!canWrite || loading}>
                        Save
                      </Button>
                      <Button onClick={cancelEdit} size="sm" variant="secondary">
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button onClick={() => startEdit(template)} size="sm" variant="secondary" disabled={!canWrite || loading}>
                        Edit
                      </Button>
                      <Button onClick={() => toggleTemplate(template)} size="sm" variant="secondary" disabled={!canWrite || loading}>
                        {template.is_active ? 'Disable' : 'Enable'}
                      </Button>
                      <Button onClick={() => deleteTemplate(template)} size="sm" variant="destructive" disabled={!canWrite || loading}>
                        Delete
                      </Button>
                    </>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </AdminTable>
    </div>
  );
}
