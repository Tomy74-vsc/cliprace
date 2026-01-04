'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminTable } from '@/components/admin/admin-table';
import { Button } from '@/components/ui/button';

type PlatformSetting = {
  key: string;
  value: unknown;
  description: string | null;
  created_at: string;
  updated_at: string;
};

interface AdminPlatformSettingsProps {
  settings: PlatformSetting[];
  canWrite?: boolean;
}

async function getCsrfToken(): Promise<string> {
  const res = await fetch('/api/auth/csrf');
  const data = await res.json();
  return data.token || '';
}

function toJsonString(value: unknown) {
  try {
    return JSON.stringify(value ?? null, null, 2);
  } catch {
    return 'null';
  }
}

function parseJson(value: string) {
  if (!value.trim()) return { ok: true, value: null };
  try {
    return { ok: true, value: JSON.parse(value) as unknown };
  } catch (error) {
    return { ok: false, error };
  }
}

export function AdminPlatformSettings({ settings, canWrite = true }: AdminPlatformSettingsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [value, setValue] = useState('{}');

  const editingSetting = useMemo(
    () => settings.find((setting) => setting.key === editingKey) ?? null,
    [settings, editingKey]
  );
  const [editDescription, setEditDescription] = useState('');
  const [editValue, setEditValue] = useState('');

  const resetCreate = () => {
    setKey('');
    setDescription('');
    setValue('{}');
  };

  const startEdit = (setting: PlatformSetting) => {
    setEditingKey(setting.key);
    setEditDescription(setting.description ?? '');
    setEditValue(toJsonString(setting.value));
  };

  const cancelEdit = () => {
    setEditingKey(null);
  };

  const createSetting = async () => {
    if (!canWrite) {
      window.alert("Accès en lecture seule : impossible de modifier les settings.");
      return;
    }
    setLoading(true);
    try {
      const token = await getCsrfToken();
      const parsed = parseJson(value);
      if (!parsed.ok) {
        window.alert('Invalid JSON value.');
        return;
      }
      const payload = {
        key: key.trim(),
        description: description.trim() || null,
        value: parsed.value,
      };
      const res = await fetch('/api/admin/settings', {
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

  const saveSetting = async () => {
    if (!editingSetting) return;
    if (!canWrite) {
      window.alert("Accès en lecture seule : impossible de modifier les settings.");
      return;
    }
    setLoading(true);
    try {
      const token = await getCsrfToken();
      const parsed = parseJson(editValue);
      if (!parsed.ok) {
        window.alert('Invalid JSON value.');
        return;
      }
      const payload = {
        description: editDescription.trim() || null,
        value: parsed.value,
      };
      const res = await fetch(`/api/admin/settings/${editingSetting.key}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-csrf': token },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        window.alert(data?.message || 'Update failed');
        return;
      }
      setEditingKey(null);
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  const deleteSetting = async (setting: PlatformSetting) => {
    if (!canWrite) {
      window.alert("Accès en lecture seule : impossible de modifier les settings.");
      return;
    }
    const ok = window.confirm('Delete this setting?');
    if (!ok) return;
    setLoading(true);
    try {
      const token = await getCsrfToken();
      const res = await fetch(`/api/admin/settings/${setting.key}`, {
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
      {canWrite ? (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-soft space-y-3">
          <div className="text-sm font-semibold">Create setting</div>
          <div className="grid gap-3 lg:grid-cols-3">
            <input
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
              placeholder="Key"
              value={key}
              onChange={(event) => setKey(event.target.value)}
            />
            <input
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
              placeholder="Description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            <div className="text-xs text-muted-foreground flex items-center">
              JSON value stored in database.
            </div>
          </div>
          <textarea
            className="min-h-[120px] rounded-xl border border-border bg-background px-3 py-2 text-xs font-mono"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder='{"key":"value"}'
          />
          <Button onClick={createSetting} loading={loading} variant="primary">
            Create setting
          </Button>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-soft text-sm text-muted-foreground">
          Lecture seule : tu peux consulter les settings mais pas les modifier.
        </div>
      )}

      <AdminTable>
        <thead className="text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Key</th>
            <th className="px-4 py-3">Description</th>
            <th className="px-4 py-3">Value</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border text-sm">
          {settings.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                Aucun paramètre configuré
              </td>
            </tr>
          ) : (
            settings.map((setting) => (
              <tr key={setting.key} className="hover:bg-muted/30">
                <td className="px-4 py-4">
                  <div className="font-medium">{setting.key}</div>
                </td>
                <td className="px-4 py-4">
                  {editingKey === setting.key ? (
                    <input
                      className="h-9 rounded-lg border border-border bg-background px-2 text-sm w-full"
                      value={editDescription}
                      onChange={(event) => setEditDescription(event.target.value)}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {setting.description || '-'}
                    </span>
                  )}
                </td>
                <td className="px-4 py-4">
                  {editingKey === setting.key ? (
                    <textarea
                      className="min-h-[80px] w-full rounded-lg border border-border bg-background px-2 py-1 text-xs font-mono"
                      value={editValue}
                      onChange={(event) => setEditValue(event.target.value)}
                    />
                  ) : (
                    <code className="text-xs text-muted-foreground">
                      {toJsonString(setting.value)}
                    </code>
                  )}
                </td>
                <td className="px-4 py-4 space-y-2">
                  {editingKey === setting.key ? (
                    <>
                      <Button onClick={saveSetting} loading={loading} size="sm" variant="primary">
                        Save
                      </Button>
                      <Button onClick={cancelEdit} size="sm" variant="secondary">
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button onClick={() => startEdit(setting)} size="sm" variant="secondary" disabled={!canWrite}>
                        Edit
                      </Button>
                      <Button onClick={() => deleteSetting(setting)} size="sm" variant="destructive" disabled={!canWrite}>
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
