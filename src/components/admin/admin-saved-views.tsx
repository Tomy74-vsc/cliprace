'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Bookmark, Trash2, Users, User, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useCsrfToken } from '@/hooks/use-csrf-token';

type SavedView = {
  id: string;
  name: string;
  params: Record<string, string>;
  route: string;
  visibility?: 'personal' | 'team';
  is_default?: boolean;
  created_by?: string;
};

function storageKey(route: string) {
  return `admin_saved_views:${route}`;
}

function serializeParams(params: Record<string, string>) {
  const entries = Object.entries(params).filter(([, v]) => v !== '');
  return new URLSearchParams(entries).toString();
}

function loadLocal(route: string): SavedView[] {
  try {
    const raw = localStorage.getItem(storageKey(route));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v) => v && typeof v.id === 'string' && typeof v.name === 'string');
  } catch {
    return [];
  }
}

function saveLocal(route: string, views: SavedView[]) {
  localStorage.setItem(storageKey(route), JSON.stringify(views));
}

export function AdminSavedViews() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const csrfToken = useCsrfToken();

  const [openSave, setOpenSave] = useState(false);
  const [openManage, setOpenManage] = useState(false);
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<'personal' | 'team'>('personal');
  const [isDefault, setIsDefault] = useState(false);
  const [views, setViews] = useState<SavedView[]>([]);
  const [backendAvailable, setBackendAvailable] = useState(true);

  const currentParams = useMemo(() => Object.fromEntries(searchParams.entries()), [searchParams]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/admin/saved-views?route=${encodeURIComponent(pathname)}`, {
          credentials: 'include',
        });
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (res.ok && data?.ok && Array.isArray(data.items) && !data.missing_table) {
          setBackendAvailable(true);
          setViews(
            data.items.map((v: UnsafeAny) => ({
              id: v.id,
              name: v.name,
              params: (v.params ?? {}) as Record<string, string>,
              route: v.route,
              visibility: v.visibility || 'personal',
              is_default: v.is_default || false,
              created_by: v.created_by,
            }))
          );
          return;
        }
        if (res.ok && data?.ok && data.missing_table) {
          setBackendAvailable(false);
          setViews(loadLocal(pathname));
          return;
        }
        setBackendAvailable(false);
        setViews(loadLocal(pathname));
      } catch {
        if (!cancelled) {
          setBackendAvailable(false);
          setViews(loadLocal(pathname));
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const applyView = (view: SavedView) => {
    const qs = serializeParams(view.params);
    router.push(qs ? `${view.route}?${qs}` : view.route);
  };

  const createView = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) return;

    const params = { ...currentParams };
    delete params.page;
    delete params.limit;

    if (!backendAvailable || !csrfToken) {
      const next: SavedView[] = [
        ...views.filter((v) => v.name !== trimmed),
        { id: `local:${Date.now()}`, route: pathname, name: trimmed, params },
      ].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
      setViews(next);
      saveLocal(pathname, next);
      setOpenSave(false);
      setName('');
      return;
    }

    const res = await fetch('/api/admin/saved-views', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf': csrfToken },
      credentials: 'include',
      body: JSON.stringify({ 
        route: pathname, 
        name: trimmed, 
        params,
        visibility,
        is_default: isDefault,
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      setBackendAvailable(false);
      const next = loadLocal(pathname);
      setViews(next);
      setOpenSave(false);
      setName('');
      return;
    }
    setViews((prev) =>
      [...prev.filter((v) => v.id !== data.item.id), data.item].sort((a, b) =>
        a.name.localeCompare(b.name, 'fr')
      )
    );
    setOpenSave(false);
    setName('');
  };

  const removeView = async (view: SavedView) => {
    if (!backendAvailable || view.id.startsWith('local:') || !csrfToken) {
      const next = views.filter((v) => v.id !== view.id);
      setViews(next);
      saveLocal(pathname, next);
      return;
    }

    const res = await fetch(`/api/admin/saved-views/${encodeURIComponent(view.id)}`, {
      method: 'DELETE',
      headers: { 'x-csrf': csrfToken },
      credentials: 'include',
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.ok) {
      setViews((prev) => prev.filter((v) => v.id !== view.id));
    } else if (res.ok && data?.missing_table) {
      setBackendAvailable(false);
      const next = views.filter((v) => v.id !== view.id);
      setViews(next);
      saveLocal(pathname, next);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="sm" className="gap-2">
            <Bookmark className="h-4 w-4" />
            <span className="hidden md:inline">Vues</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[260px]">
          <DropdownMenuItem onSelect={() => setOpenSave(true)}>Sauvegarder la vue actuelle…</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setOpenManage(true)}>Gérer…</DropdownMenuItem>
          <div className="my-1 h-px bg-border" />
          {views.length === 0 ? (
            <div className="px-2 py-2 text-xs text-muted-foreground">
              Aucune vue sauvegardée pour cette page.
            </div>
          ) : (
            views.map((view) => (
              <DropdownMenuItem key={view.id} onSelect={() => applyView(view)}>
                <div className="flex items-center gap-2 w-full">
                  {view.is_default && <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />}
                  <span className="flex-1">{view.name}</span>
                  {view.visibility === 'team' ? (
                    <Badge variant="secondary" className="text-xs">
                      <Users className="h-3 w-3 mr-1" />
                      Team
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      <User className="h-3 w-3 mr-1" />
                      Perso
                    </Badge>
                  )}
                </div>
              </DropdownMenuItem>
            ))
          )}
          {!backendAvailable ? (
            <div className="px-2 py-2 text-[11px] text-muted-foreground">
              Mode local (applique `db_refonte/41_admin_saved_views.sql` pour le stockage DB).
            </div>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={openSave} onOpenChange={setOpenSave}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sauvegarder une vue</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              label="Nom"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Mes concours actifs"
            />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="visibility" className="flex items-center gap-2">
                  {visibility === 'team' ? <Users className="h-4 w-4" /> : <User className="h-4 w-4" />}
                  Visibilité
                </Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant={visibility === 'personal' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setVisibility('personal')}
                  >
                    <User className="h-4 w-4 mr-1" />
                    Personnel
                  </Button>
                  <Button
                    variant={visibility === 'team' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setVisibility('team')}
                  >
                    <Users className="h-4 w-4 mr-1" />
                    Équipe
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="is_default" className="flex items-center gap-2">
                  <Star className="h-4 w-4" />
                  Vue par défaut
                </Label>
                <Switch
                  id="is_default"
                  checked={isDefault}
                  onCheckedChange={setIsDefault}
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => {
                setOpenSave(false);
                setName('');
                setVisibility('personal');
                setIsDefault(false);
              }}>
                Annuler
              </Button>
              <Button onClick={createView} disabled={name.trim().length < 2}>
                Sauvegarder
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openManage} onOpenChange={setOpenManage}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Gérer les vues</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {views.length === 0 ? (
              <div className="text-sm text-muted-foreground">Aucune vue sauvegardée.</div>
            ) : (
              views.map((view) => (
                <div
                  key={view.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="font-medium truncate">{view.name}</div>
                      {view.is_default && (
                        <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                      )}
                      {view.visibility === 'team' ? (
                        <Badge variant="secondary" className="text-xs">
                          <Users className="h-3 w-3 mr-1" />
                          Team
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          <User className="h-3 w-3 mr-1" />
                          Perso
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {serializeParams(view.params) || '(aucun filtre)'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={() => applyView(view)}>
                      Ouvrir
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => removeView(view)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}


