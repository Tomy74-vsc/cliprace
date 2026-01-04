'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Bell } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useAdminInbox } from '@/components/admin/admin-inbox-provider';

type OpsTaskItem = {
  id: string;
  task_type: string;
  title: string;
  description: string | null;
  href: string;
  count: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
};

export function AdminInboxDropdown() {
  const { summary, refresh } = useAdminInbox();
  const [open, setOpen] = useState(false);
  const [ops, setOps] = useState<OpsTaskItem[]>([]);
  const [loading, setLoading] = useState(false);

  const badgeCount = summary?.badge_count ?? 0;
  const signals = summary?.signals?.items ?? [];

  useEffect(() => {
    if (!open) return;
    void refresh();

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/admin/inbox/items?kind=ops&scope=team&limit=6', { cache: 'no-store' });
        const data = await res.json();
        setOps(Array.isArray(data?.items) ? data.items : []);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [open, refresh]);

  const topOps = useMemo(() => ops.slice(0, 6), [ops]);
  const topSignals = useMemo(() => signals.slice(0, 4), [signals]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative h-12 w-12 rounded-full" aria-label="À traiter">
          <Bell className="h-10 w-10" />
          {badgeCount > 0 ? (
            <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[11px] leading-none flex items-center justify-center shadow-sm">
              {badgeCount > 99 ? '99+' : badgeCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[420px] p-2">
        <div className="flex items-center justify-between gap-2 px-2 py-1">
          <div className="text-sm font-semibold">À traiter</div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/app/admin/inbox">Voir tout</Link>
          </Button>
        </div>
        <DropdownMenuSeparator />

        <DropdownMenuLabel>À faire</DropdownMenuLabel>
        {loading ? (
          <div className="px-2 py-2 text-sm text-muted-foreground">Chargement…</div>
        ) : topOps.length === 0 ? (
          <div className="px-2 py-2 text-sm text-muted-foreground">Rien à traiter pour le moment.</div>
        ) : (
          topOps.map((item) => (
            <DropdownMenuItem key={item.id} asChild>
              <Link href={item.href} className={cn('flex items-start gap-3 px-2 py-2 rounded-md', 'hover:bg-muted focus:bg-muted')}>
                <span
                  className={cn(
                    'mt-1 h-2.5 w-2.5 rounded-full',
                    item.priority === 'urgent'
                      ? 'bg-destructive'
                      : item.priority === 'high'
                        ? 'bg-warning'
                        : 'bg-primary'
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate">{item.title}</span>
                    <Badge variant="danger" className="shrink-0">
                      {item.count > 99 ? '99+' : item.count}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{item.description || item.task_type}</div>
                </div>
              </Link>
            </DropdownMenuItem>
          ))
        )}

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Signaux</DropdownMenuLabel>
        {topSignals.length === 0 ? (
          <div className="px-2 py-2 text-sm text-muted-foreground">Aucun signal.</div>
        ) : (
          topSignals.map((sig) => (
            <DropdownMenuItem key={sig.key} asChild>
              <Link href={sig.href} className="flex items-start gap-3 px-2 py-2 rounded-md">
                <span
                  className={cn(
                    'mt-1 h-2.5 w-2.5 rounded-full',
                    sig.severity === 'danger' ? 'bg-destructive' : sig.severity === 'warning' ? 'bg-warning' : 'bg-primary'
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate">{sig.title}</span>
                    {typeof sig.count === 'number' ? (
                      <Badge
                        variant={sig.severity === 'danger' ? 'danger' : sig.severity === 'warning' ? 'warning' : 'info'}
                        className="shrink-0"
                      >
                        {sig.count > 99 ? '99+' : sig.count}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{sig.message}</div>
                </div>
              </Link>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

