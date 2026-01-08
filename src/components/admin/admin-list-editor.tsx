'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type ListItemType = 'string' | 'number';

export type AdminListEditorProps = {
  items: string[];
  onChange: (next: string[]) => void;
  itemType?: ListItemType;
  onTypeChange?: (next: ListItemType) => void;
  addLabel?: string;
  emptyLabel?: string;
  className?: string;
};

export function AdminListEditor({
  items,
  onChange,
  itemType = 'string',
  onTypeChange,
  addLabel = 'Add item',
  emptyLabel = 'No items yet.',
  className,
}: AdminListEditorProps) {
  const addItem = () => onChange([...items, '']);
  const updateItem = (index: number, value: string) => {
    onChange(items.map((item, idx) => (idx === index ? value : item)));
  };
  const removeItem = (index: number) => {
    onChange(items.filter((_, idx) => idx !== index));
  };

  return (
    <div className={cn('space-y-2', className)}>
      {onTypeChange ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Item type</span>
          <select
            className="h-8 rounded-lg border border-border bg-background px-2 text-xs"
            value={itemType}
            onChange={(event) => onTypeChange(event.target.value as ListItemType)}
          >
            <option value="string">string</option>
            <option value="number">number</option>
          </select>
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="text-xs text-muted-foreground">{emptyLabel}</div>
      ) : (
        items.map((item, index) => (
          <div key={`${index}`} className="grid gap-2 md:grid-cols-[1fr_auto] items-center">
            <input
              className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
              type={itemType === 'number' ? 'number' : 'text'}
              placeholder="Item"
              value={item}
              onChange={(event) => updateItem(index, event.target.value)}
            />
            <Button type="button" size="sm" variant="ghost" onClick={() => removeItem(index)}>
              Remove
            </Button>
          </div>
        ))
      )}

      <Button type="button" size="sm" variant="secondary" onClick={addItem}>
        {addLabel}
      </Button>
    </div>
  );
}
