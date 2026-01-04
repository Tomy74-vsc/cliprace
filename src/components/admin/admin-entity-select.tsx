'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type Kind = 'user' | 'brand' | 'org' | 'contest';

type LookupItem = {
  id: string;
  label: string;
  subtitle?: string | null;
};

async function fetchLookup(params: Record<string, string>) {
  const url = `/api/admin/lookup?${new URLSearchParams(params).toString()}`;
  const res = await fetch(url, { credentials: 'include' });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok || !Array.isArray(data.items)) return [] as LookupItem[];
  return data.items as LookupItem[];
}

export function AdminEntitySelect({
  kind,
  name,
  label,
  placeholder,
  defaultValue,
  className,
}: {
  kind: Kind;
  name: string;
  label: string;
  placeholder: string;
  defaultValue?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [selected, setSelected] = useState<LookupItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<LookupItem[]>([]);

  const hasSelection = !!selected?.id;
  const query = text.trim();
  const enabled = useMemo(() => query.length >= 2, [query.length]);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      if (!defaultValue) return;
      setLoading(true);
      try {
        const data = await fetchLookup({ kind, id: defaultValue, limit: '1' });
        if (cancelled) return;
        setSelected(data[0] ?? { id: defaultValue, label: defaultValue, subtitle: null });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void init();
    return () => {
      cancelled = true;
    };
  }, [defaultValue, kind]);

  useEffect(() => {
    if (!open) return;
    if (!enabled) {
      setItems([]);
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const url = `/api/admin/lookup?${new URLSearchParams({
          kind,
          q: query,
          limit: '10',
        }).toString()}`;
        const res = await fetch(url, { credentials: 'include', signal: controller.signal });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.ok && Array.isArray(data.items)) setItems(data.items);
        else setItems([]);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [enabled, kind, open, query]);

  const clear = () => {
    setSelected(null);
    setText('');
    setItems([]);
    setOpen(false);
  };

  const pick = (item: LookupItem) => {
    setSelected(item);
    setText('');
    setItems([]);
    setOpen(false);
  };

  return (
    <div className={cn('relative flex flex-col gap-2', className)}>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>

      <input type="hidden" name={name} value={selected?.id ?? ''} />

      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 text-sm',
            'hover:bg-muted/20 transition-colors',
          )}
        >
          <div className="min-w-0 text-left">
            {hasSelection ? (
              <>
                <div className="truncate font-medium">{selected?.label}</div>
                {selected?.subtitle ? (
                  <div className="truncate text-xs text-muted-foreground">{selected.subtitle}</div>
                ) : null}
              </>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>

        {hasSelection ? (
          <button
            type="button"
            onClick={clear}
            className="absolute right-10 top-1/2 -translate-y-1/2 rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-muted/40"
            aria-label="Effacer"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}

        {open ? (
          <div className="absolute z-30 mt-2 w-full rounded-2xl border border-border bg-popover p-2 shadow-soft">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={placeholder}
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
              autoFocus
            />
            <div className="mt-2 max-h-64 overflow-auto">
              {loading ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">Chargement...</div>
              ) : items.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  {enabled ? 'Aucun résultat' : 'Tape au moins 2 caractères'}
                </div>
              ) : (
                <div className="space-y-1">
                  {items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => pick(item)}
                      className="w-full rounded-xl px-3 py-2 text-left hover:bg-muted/40"
                    >
                      <div className="font-medium truncate">{item.label}</div>
                      {item.subtitle ? (
                        <div className="text-xs text-muted-foreground truncate">{item.subtitle}</div>
                      ) : null}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {defaultValue && !selected ? (
              <div className="mt-2 px-3 py-2 text-xs text-muted-foreground">
                Valeur actuelle : {defaultValue}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

