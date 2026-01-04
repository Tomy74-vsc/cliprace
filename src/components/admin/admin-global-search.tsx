'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

type SearchItem = {
  type: 'user' | 'brand' | 'org' | 'contest' | 'submission';
  id: string;
  title: string;
  subtitle?: string | null;
  href: string;
};

function typeLabel(type: SearchItem['type']) {
  if (type === 'user') return 'Utilisateur';
  if (type === 'brand') return 'Marque';
  if (type === 'org') return 'Organisation';
  if (type === 'contest') return 'Concours';
  return 'Soumission';
}

function typeVariant(type: SearchItem['type']) {
  if (type === 'user') return 'info' as const;
  if (type === 'brand') return 'secondary' as const;
  if (type === 'org') return 'default' as const;
  if (type === 'contest') return 'warning' as const;
  return 'pending' as const;
}

export function AdminGlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<SearchItem[]>([]);
  const trimmed = query.trim();

  const enabled = useMemo(() => trimmed.length >= 2, [trimmed.length]);

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
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(trimmed)}&limit=10`, {
          method: 'GET',
          credentials: 'include',
          signal: controller.signal,
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.ok && Array.isArray(data.items)) {
          setItems(data.items);
        } else {
          setItems([]);
        }
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
  }, [enabled, open, trimmed]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" className="gap-2">
          <Search className="h-4 w-4" />
          <span className="hidden md:inline">Recherche</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Recherche globale</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher (email, nom, org, concours...)"
          />

          <div className="max-h-[60vh] overflow-auto rounded-2xl border border-border">
            {loading ? (
              <div className="px-4 py-3 text-sm text-muted-foreground">Recherche en cours...</div>
            ) : items.length === 0 ? (
              <div className="px-4 py-3 text-sm text-muted-foreground">
                {enabled ? 'Aucun résultat' : 'Tape au moins 2 caractères'}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {items.map((item) => (
                  <button
                    key={`${item.type}:${item.id}`}
                    type="button"
                    onClick={() => go(item.href)}
                    className="w-full px-4 py-3 text-left hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{item.title}</div>
                        {item.subtitle ? (
                          <div className="text-xs text-muted-foreground truncate">{item.subtitle}</div>
                        ) : null}
                      </div>
                      <Badge variant={typeVariant(item.type)} className="shrink-0">
                        {typeLabel(item.type)}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

