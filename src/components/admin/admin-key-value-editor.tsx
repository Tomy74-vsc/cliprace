'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type KeyValueType = 'string' | 'number' | 'boolean';

export type KeyValueEntry = {
  id: string;
  key: string;
  type: KeyValueType;
  value: string;
};

type AdminKeyValueEditorProps = {
  entries: KeyValueEntry[];
  onChange: (next: KeyValueEntry[]) => void;
  addLabel?: string;
  emptyLabel?: string;
  className?: string;
};

function createId() {
  return `kv_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export function entriesFromRecord(record: Record<string, unknown> | null | undefined): KeyValueEntry[] {
  if (!record) return [];
  return Object.entries(record).map(([key, value]) => {
    if (typeof value === 'number') {
      return { id: createId(), key, type: 'number', value: String(value) };
    }
    if (typeof value === 'boolean') {
      return { id: createId(), key, type: 'boolean', value: value ? 'true' : 'false' };
    }
    return { id: createId(), key, type: 'string', value: value == null ? '' : String(value) };
  });
}

export function recordFromEntries(entries: KeyValueEntry[]): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const entry of entries) {
    const key = entry.key.trim();
    if (!key) continue;
    if (entry.type === 'number') {
      const num = Number(entry.value);
      if (!Number.isFinite(num)) continue;
      output[key] = num;
      continue;
    }
    if (entry.type === 'boolean') {
      output[key] = entry.value === 'true';
      continue;
    }
    output[key] = entry.value;
  }
  return output;
}

export function AdminKeyValueEditor({
  entries,
  onChange,
  addLabel = 'Add field',
  emptyLabel = 'No fields yet.',
  className,
}: AdminKeyValueEditorProps) {
  const addEntry = () => {
    onChange([
      ...entries,
      {
        id: createId(),
        key: '',
        type: 'string',
        value: '',
      },
    ]);
  };

  const updateEntry = (id: string, patch: Partial<KeyValueEntry>) => {
    onChange(entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  };

  const removeEntry = (id: string) => {
    onChange(entries.filter((entry) => entry.id !== id));
  };

  return (
    <div className={cn('space-y-2', className)}>
      {entries.length === 0 ? (
        <div className="text-xs text-muted-foreground">{emptyLabel}</div>
      ) : (
        entries.map((entry) => (
          <div key={entry.id} className="grid gap-2 md:grid-cols-[1.2fr_0.7fr_1.3fr_auto] items-center">
            <input
              className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
              placeholder="Key"
              value={entry.key}
              onChange={(event) => updateEntry(entry.id, { key: event.target.value })}
            />
            <select
              className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
              value={entry.type}
              onChange={(event) => updateEntry(entry.id, { type: event.target.value as KeyValueType })}
            >
              <option value="string">string</option>
              <option value="number">number</option>
              <option value="boolean">boolean</option>
            </select>
            {entry.type === 'boolean' ? (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={entry.value === 'true'}
                  onChange={(event) => updateEntry(entry.id, { value: event.target.checked ? 'true' : 'false' })}
                />
                {entry.value === 'true' ? 'true' : 'false'}
              </label>
            ) : (
              <input
                className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
                type={entry.type === 'number' ? 'number' : 'text'}
                placeholder="Value"
                value={entry.value}
                onChange={(event) => updateEntry(entry.id, { value: event.target.value })}
              />
            )}
            <Button type="button" size="sm" variant="ghost" onClick={() => removeEntry(entry.id)}>
              Remove
            </Button>
          </div>
        ))
      )}
      <Button type="button" size="sm" variant="secondary" onClick={addEntry}>
        {addLabel}
      </Button>
    </div>
  );
}
