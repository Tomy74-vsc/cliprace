'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminTable } from '@/components/admin/admin-table';
import { Button } from '@/components/ui/button';
import {
  AdminKeyValueEditor,
  type KeyValueEntry,
  entriesFromRecord,
  recordFromEntries,
} from '@/components/admin/admin-key-value-editor';
import { AdminListEditor, type ListItemType } from '@/components/admin/admin-list-editor';
import { getCsrfToken } from '@/lib/csrf-client';

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

type ValueKind = 'string' | 'number' | 'boolean' | 'object' | 'list';

type ValueState = {
  kind: ValueKind;
  stringValue: string;
  numberValue: string;
  booleanValue: boolean;
  objectEntries: KeyValueEntry[];
  listItems: string[];
  listItemType: ListItemType;
};

const EMPTY_VALUE_STATE: ValueState = {
  kind: 'string',
  stringValue: '',
  numberValue: '',
  booleanValue: false,
  objectEntries: [],
  listItems: [],
  listItemType: 'string',
};

function buildValueState(value: unknown): ValueState {
  if (Array.isArray(value)) {
    const allNumbers = value.every((item) => typeof item === 'number' && Number.isFinite(item));
    return {
      ...EMPTY_VALUE_STATE,
      kind: 'list',
      listItemType: allNumbers ? 'number' : 'string',
      listItems: value.map((item) => (item == null ? '' : String(item))),
    };
  }
  if (value && typeof value === 'object') {
    return {
      ...EMPTY_VALUE_STATE,
      kind: 'object',
      objectEntries: entriesFromRecord(value as Record<string, unknown>),
    };
  }
  if (typeof value === 'boolean') {
    return { ...EMPTY_VALUE_STATE, kind: 'boolean', booleanValue: value };
  }
  if (typeof value === 'number') {
    return { ...EMPTY_VALUE_STATE, kind: 'number', numberValue: String(value) };
  }
  if (typeof value === 'string') {
    return { ...EMPTY_VALUE_STATE, kind: 'string', stringValue: value };
  }
  return { ...EMPTY_VALUE_STATE };
}

function resolveValue(state: ValueState) {
  if (state.kind === 'number') {
    const num = Number(state.numberValue);
    if (!Number.isFinite(num)) {
      return { ok: false, message: 'Number value is invalid.' };
    }
    return { ok: true, value: num };
  }
  if (state.kind === 'boolean') {
    return { ok: true, value: state.booleanValue };
  }
  if (state.kind === 'object') {
    return { ok: true, value: recordFromEntries(state.objectEntries) };
  }
  if (state.kind === 'list') {
    const items = state.listItems.filter((item) => item !== '');
    if (state.listItemType === 'number') {
      const numbers = items.map((item) => Number(item));
      if (numbers.some((num) => !Number.isFinite(num))) {
        return { ok: false, message: 'List items must be numbers.' };
      }
      return { ok: true, value: numbers };
    }
    return { ok: true, value: items };
  }
  return { ok: true, value: state.stringValue };
}

function formatValuePreview(value: unknown) {
  if (Array.isArray(value)) {
    return value.length ? `List (${value.length})` : 'List (empty)';
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>);
    return keys.length ? `Object (${keys.length})` : 'Object (empty)';
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value || '-';
  return '-';
}

function ValueEditor({
  state,
  onChange,
}: {
  state: ValueState;
  onChange: (next: ValueState) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Value type</span>
        <select
          className="h-8 rounded-lg border border-border bg-background px-2 text-xs"
          value={state.kind}
          onChange={(event) => onChange({ ...state, kind: event.target.value as ValueKind })}
        >
          <option value="string">string</option>
          <option value="number">number</option>
          <option value="boolean">boolean</option>
          <option value="object">object</option>
          <option value="list">list</option>
        </select>
      </div>

      {state.kind === 'string' ? (
        <input
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
          placeholder="Value"
          value={state.stringValue}
          onChange={(event) => onChange({ ...state, stringValue: event.target.value })}
        />
      ) : null}

      {state.kind === 'number' ? (
        <input
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
          placeholder="0"
          type="number"
          value={state.numberValue}
          onChange={(event) => onChange({ ...state, numberValue: event.target.value })}
        />
      ) : null}

      {state.kind === 'boolean' ? (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={state.booleanValue}
            onChange={(event) => onChange({ ...state, booleanValue: event.target.checked })}
          />
          {state.booleanValue ? 'true' : 'false'}
        </label>
      ) : null}

      {state.kind === 'object' ? (
        <AdminKeyValueEditor
          entries={state.objectEntries}
          onChange={(next) => onChange({ ...state, objectEntries: next })}
          addLabel="Add field"
          emptyLabel="No fields."
        />
      ) : null}

      {state.kind === 'list' ? (
        <AdminListEditor
          items={state.listItems}
          itemType={state.listItemType}
          onTypeChange={(next) => onChange({ ...state, listItemType: next })}
          onChange={(next) => onChange({ ...state, listItems: next })}
          addLabel="Add item"
          emptyLabel="No list items."
        />
      ) : null}
    </div>
  );
}

export function AdminPlatformSettings({ settings, canWrite = true }: AdminPlatformSettingsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [valueState, setValueState] = useState<ValueState>(EMPTY_VALUE_STATE);

  const editingSetting = useMemo(
    () => settings.find((setting) => setting.key === editingKey) ?? null,
    [settings, editingKey]
  );
  const [editDescription, setEditDescription] = useState('');
  const [editValueState, setEditValueState] = useState<ValueState>(EMPTY_VALUE_STATE);

  const resetCreate = () => {
    setKey('');
    setDescription('');
    setValueState(EMPTY_VALUE_STATE);
  };

  const startEdit = (setting: PlatformSetting) => {
    setEditingKey(setting.key);
    setEditDescription(setting.description ?? '');
    setEditValueState(buildValueState(setting.value));
  };

  const cancelEdit = () => {
    setEditingKey(null);
  };

  const createSetting = async () => {
    if (!canWrite) {
      window.alert('Read only access: settings.write required.');
      return;
    }
    setLoading(true);
    try {
      const token = await getCsrfToken();
      const resolved = resolveValue(valueState);
      if (!resolved.ok) {
        window.alert(resolved.message || 'Invalid value.');
        return;
      }
      const payload = {
        key: key.trim(),
        description: description.trim() || null,
        value: resolved.value,
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
      window.alert('Read only access: settings.write required.');
      return;
    }
    setLoading(true);
    try {
      const token = await getCsrfToken();
      const resolved = resolveValue(editValueState);
      if (!resolved.ok) {
        window.alert(resolved.message || 'Invalid value.');
        return;
      }
      const payload = {
        description: editDescription.trim() || null,
        value: resolved.value,
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
      window.alert('Read only access: settings.write required.');
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
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label htmlFor="setting-key" className="text-xs font-medium text-muted-foreground">
                Key
              </label>
              <input
                id="setting-key"
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                placeholder="billing.default_currency"
                value={key}
                onChange={(event) => setKey(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label
                htmlFor="setting-description"
                className="text-xs font-medium text-muted-foreground"
              >
                Description
              </label>
              <input
                id="setting-description"
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                placeholder="Short description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
          </div>
          <ValueEditor state={valueState} onChange={setValueState} />
          <Button onClick={createSetting} loading={loading} variant="primary">
            Create setting
          </Button>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-soft text-sm text-muted-foreground">
          Read only - you can view settings but cannot edit them.
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
                No settings configured yet.
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
                    <ValueEditor state={editValueState} onChange={setEditValueState} />
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {formatValuePreview(setting.value)}
                    </span>
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
                      <Button
                        onClick={() => startEdit(setting)}
                        size="sm"
                        variant="secondary"
                        disabled={!canWrite}
                      >
                        Edit
                      </Button>
                      <Button
                        onClick={() => deleteSetting(setting)}
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
