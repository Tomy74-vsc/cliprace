'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminTable } from '@/components/admin/admin-table';
import { Button } from '@/components/ui/button';
import { getCsrfToken } from '@/lib/csrf-client';

type FeatureFlag = {
  key: string;
  description: string | null;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
};

interface AdminFeatureFlagsProps {
  flags: FeatureFlag[];
  canWrite?: boolean;
}

export function AdminFeatureFlags({ flags, canWrite = true }: AdminFeatureFlagsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [isEnabled, setIsEnabled] = useState(false);

  const editingFlag = useMemo(
    () => flags.find((flag) => flag.key === editingKey) ?? null,
    [flags, editingKey]
  );
  const [editDescription, setEditDescription] = useState('');
  const [editEnabled, setEditEnabled] = useState(false);

  const resetCreate = () => {
    setKey('');
    setDescription('');
    setIsEnabled(false);
  };

  const startEdit = (flag: FeatureFlag) => {
    setEditingKey(flag.key);
    setEditDescription(flag.description ?? '');
    setEditEnabled(flag.is_enabled);
  };

  const cancelEdit = () => {
    setEditingKey(null);
  };

  const createFlag = async () => {
    if (!canWrite) {
      window.alert('Read only access: settings.write required.');
      return;
    }
    setLoading(true);
    try {
      const token = await getCsrfToken();
      const payload = {
        key: key.trim(),
        description: description.trim() || null,
        is_enabled: isEnabled,
      };
      const res = await fetch('/api/admin/feature-flags', {
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

  const saveFlag = async () => {
    if (!editingFlag) return;
    if (!canWrite) {
      window.alert('Read only access: settings.write required.');
      return;
    }
    setLoading(true);
    try {
      const token = await getCsrfToken();
      const payload = {
        description: editDescription.trim() || null,
        is_enabled: editEnabled,
      };
      const res = await fetch(`/api/admin/feature-flags/${editingFlag.key}`, {
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

  const toggleFlag = async (flag: FeatureFlag) => {
    if (!canWrite) {
      window.alert('Read only access: settings.write required.');
      return;
    }
    setLoading(true);
    try {
      const token = await getCsrfToken();
      const res = await fetch(`/api/admin/feature-flags/${flag.key}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-csrf': token },
        body: JSON.stringify({ is_enabled: !flag.is_enabled }),
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

  const deleteFlag = async (flag: FeatureFlag) => {
    if (!canWrite) {
      window.alert('Read only access: settings.write required.');
      return;
    }
    const ok = window.confirm('Delete this flag?');
    if (!ok) return;
    setLoading(true);
    try {
      const token = await getCsrfToken();
      const res = await fetch(`/api/admin/feature-flags/${flag.key}`, {
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
          <div className="text-sm font-semibold">Create feature flag</div>
          <div className="grid gap-3 lg:grid-cols-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="flag-key" className="text-xs font-medium text-muted-foreground">
                Key
              </label>
              <input
                id="flag-key"
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                placeholder="feature.new_checkout"
                value={key}
                onChange={(event) => setKey(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="flag-description" className="text-xs font-medium text-muted-foreground">
                Description
              </label>
              <input
                id="flag-description"
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                placeholder="Short description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={(event) => setIsEnabled(event.target.checked)}
              />
              Enabled
            </label>
            <Button onClick={createFlag} loading={loading} variant="primary">
              Create flag
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-soft text-sm text-muted-foreground">
          Read only - you can view flags but cannot edit them.
        </div>
      )}

      <AdminTable>
        <thead className="text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Key</th>
            <th className="px-4 py-3">Description</th>
            <th className="px-4 py-3">Enabled</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border text-sm">
          {flags.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                No feature flags configured yet.
              </td>
            </tr>
          ) : (
            flags.map((flag) => (
              <tr key={flag.key} className="hover:bg-muted/30">
                <td className="px-4 py-4">
                  <div className="font-medium">{flag.key}</div>
                </td>
                <td className="px-4 py-4">
                  {editingKey === flag.key ? (
                    <input
                      className="h-9 rounded-lg border border-border bg-background px-2 text-sm w-full"
                      value={editDescription}
                      onChange={(event) => setEditDescription(event.target.value)}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">{flag.description || '-'}</span>
                  )}
                </td>
                <td className="px-4 py-4">
                  {editingKey === flag.key ? (
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={editEnabled}
                        onChange={(event) => setEditEnabled(event.target.checked)}
                      />
                      Enabled
                    </label>
                  ) : (
                    <span className="text-xs text-muted-foreground">{flag.is_enabled ? 'yes' : 'no'}</span>
                  )}
                </td>
                <td className="px-4 py-4 space-y-2">
                  {editingKey === flag.key ? (
                    <>
                      <Button onClick={saveFlag} loading={loading} size="sm" variant="primary">
                        Save
                      </Button>
                      <Button onClick={cancelEdit} size="sm" variant="secondary">
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        onClick={() => startEdit(flag)}
                        size="sm"
                        variant="secondary"
                        disabled={!canWrite}
                      >
                        Edit
                      </Button>
                      <Button
                        onClick={() => toggleFlag(flag)}
                        size="sm"
                        variant="secondary"
                        disabled={!canWrite}
                      >
                        {flag.is_enabled ? 'Disable' : 'Enable'}
                      </Button>
                      <Button
                        onClick={() => deleteFlag(flag)}
                        size="sm"
                        variant="destructive"
                        disabled={!canWrite}
                      >
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
