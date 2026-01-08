'use client';

import { Checkbox } from '@/components/ui/checkbox';

interface AdminBulkSelectProps<T extends { id: string }> {
  items: T[];
  selected: Set<string>;
  onSelectAll: (selected: boolean) => void;
  disabled?: boolean;
}

export function AdminBulkSelect<T extends { id: string }>({
  items,
  selected,
  onSelectAll,
  disabled = false,
}: AdminBulkSelectProps<T>) {
  const allSelected = items.length > 0 && items.every(item => selected.has(item.id));
  const someSelected = items.some(item => selected.has(item.id)) && !allSelected;

  const handleSelectAll = (checked: boolean) => {
    onSelectAll(checked);
  };

  return (
    <div className="flex items-center gap-2">
      <Checkbox
        checked={allSelected}
        indeterminate={someSelected}
        onCheckedChange={handleSelectAll}
        disabled={disabled || items.length === 0}
        aria-label="Select all"
      />
      {selected.size > 0 && (
        <span className="text-sm text-muted-foreground">
          {selected.size} sélectionné{selected.size > 1 ? 's' : ''}
        </span>
      )}
    </div>
  );
}

interface AdminBulkSelectRowProps {
  id: string;
  selected: boolean;
  onSelect: (id: string, selected: boolean) => void;
  disabled?: boolean;
}

export function AdminBulkSelectRow({
  id,
  selected,
  onSelect,
  disabled = false,
}: AdminBulkSelectRowProps) {
  return (
    <Checkbox
      checked={selected}
      onCheckedChange={(checked) => onSelect(id, checked === true)}
      disabled={disabled}
      aria-label={`Select item ${id}`}
    />
  );
}

