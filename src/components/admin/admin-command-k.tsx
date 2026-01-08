'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, User, Building, Trophy, Video, DollarSign, Webhook, Ticket } from 'lucide-react';
import { AdminEntityDrawer } from './admin-entity-drawer';

type SearchGroup = {
  type: string;
  items: Array<{
    id: string;
    label: string;
    subtitle?: string;
    href: string;
  }>;
};

type SearchResult = {
  groups: SearchGroup[];
};

export function AdminCommandK() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerType, setDrawerType] = useState<'user' | 'contest' | 'submission' | 'cashout'>('user');
  const [drawerId, setDrawerId] = useState('');

  // Ouvrir avec ⌘K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
        setQuery('');
        setResults(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  // Recherche avec debounce
  useEffect(() => {
    if (!open || query.length < 2) {
      setResults(null);
      return;
    }

    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data);
        }
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [query, open]);

  // Navigation clavier
  useEffect(() => {
    if (!open || !results) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const totalItems = results.groups.reduce((sum, g) => sum + g.items.length, 0);
        setSelectedIndex((prev) => (prev + 1) % totalItems);
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const totalItems = results.groups.reduce((sum, g) => sum + g.items.length, 0);
        setSelectedIndex((prev) => (prev - 1 + totalItems) % totalItems);
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        let currentIndex = 0;
        for (const group of results.groups) {
          for (const item of group.items) {
            if (currentIndex === selectedIndex) {
              // Ouvrir drawer au lieu de naviguer directement
              const typeMap: Record<string, 'user' | 'contest' | 'submission' | 'cashout'> = {
                users: 'user',
                orgs: 'user', // Fallback
                contests: 'contest',
                submissions: 'submission',
                cashouts: 'cashout',
              };
              const entityType = typeMap[group.type] || 'user';
              setDrawerType(entityType);
              setDrawerId(item.id);
              setDrawerOpen(true);
              setOpen(false);
              return;
            }
            currentIndex++;
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, results, selectedIndex, router]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'users':
        return <User className="h-4 w-4" />;
      case 'orgs':
        return <Building className="h-4 w-4" />;
      case 'contests':
        return <Trophy className="h-4 w-4" />;
      case 'submissions':
        return <Video className="h-4 w-4" />;
      case 'cashouts':
        return <DollarSign className="h-4 w-4" />;
      case 'webhooks':
        return <Webhook className="h-4 w-4" />;
      case 'tickets':
        return <Ticket className="h-4 w-4" />;
      default:
        return <Search className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      users: 'Utilisateurs',
      orgs: 'Organisations',
      contests: 'Concours',
      submissions: 'Soumissions',
      cashouts: 'Cashouts',
      webhooks: 'Webhooks',
      tickets: 'Tickets',
    };
    return labels[type] || type;
  };

  let currentIndex = 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl p-0">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle>Recherche globale</DialogTitle>
        </DialogHeader>
        <div className="px-4">
          <Input
            placeholder="Rechercher utilisateurs, concours, soumissions..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="mb-4"
          />
        </div>
        <div className="max-h-[400px] overflow-y-auto px-4 pb-4">
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Recherche...</div>
          ) : !results || results.groups.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {query.length < 2 ? 'Tapez au moins 2 caractères' : 'Aucun résultat'}
            </div>
          ) : (
            <div className="space-y-4">
              {results.groups.map((group) => (
                <div key={group.type} className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
                    {getTypeIcon(group.type)}
                    {getTypeLabel(group.type)}
                    <Badge variant="secondary">{group.items.length}</Badge>
                  </div>
                  <div className="space-y-1">
                    {group.items.map((item) => {
                      const isSelected = currentIndex === selectedIndex;
                      currentIndex++;
                      return (
                        <Button
                          key={item.id}
                          variant={isSelected ? 'secondary' : 'ghost'}
                          className="w-full justify-start"
                          onClick={() => {
                            const typeMap: Record<string, 'user' | 'contest' | 'submission' | 'cashout'> = {
                              users: 'user',
                              orgs: 'user',
                              contests: 'contest',
                              submissions: 'submission',
                              cashouts: 'cashout',
                            };
                            const entityType = typeMap[group.type] || 'user';
                            setDrawerType(entityType);
                            setDrawerId(item.id);
                            setDrawerOpen(true);
                            setOpen(false);
                          }}
                        >
                          <div className="flex-1 text-left">
                            <div className="font-medium">{item.label}</div>
                            {item.subtitle && (
                              <div className="text-xs text-muted-foreground">{item.subtitle}</div>
                            )}
                          </div>
                        </Button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="border-t px-4 py-2 text-xs text-muted-foreground">
          <kbd className="px-2 py-1 rounded bg-muted">⌘K</kbd> pour ouvrir • <kbd className="px-2 py-1 rounded bg-muted">↑↓</kbd> pour naviguer • <kbd className="px-2 py-1 rounded bg-muted">Enter</kbd> pour sélectionner
        </div>
      </DialogContent>
      <AdminEntityDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        entityType={drawerType}
        entityId={drawerId}
      />
    </Dialog>
  );
}

