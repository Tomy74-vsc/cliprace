/*
Notifications dropdown : affiche les notifs non lues + accès page liste.
*/
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/formatters';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useCsrfToken } from '@/hooks/use-csrf-token';

type NotificationItem = {
  id: string;
  type: string;
  content: Record<string, string>;
  created_at: string;
  read: boolean;
};

export function NotificationsDropdown() {
  const pathname = usePathname();
  const csrfToken = useCsrfToken();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const unread = items.filter((n) => !n.read).length;
  const panelRef = useRef<HTMLDivElement | null>(null);
  const isBrandArea = pathname?.startsWith('/app/brand');
  const basePath = isBrandArea ? '/app/brand' : '/app/creator';

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && open && items.length > 0) {
        e.preventDefault();
        setActiveIndex((prev) => {
          const next = e.key === 'ArrowDown' ? prev + 1 : prev - 1;
          if (next < 0) return items.length - 1;
          if (next >= items.length) return 0;
          return next;
        });
      }
    }
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, items.length]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (!open || items.length === 0) return;
    const links = panelRef.current?.querySelectorAll<HTMLAnchorElement>(
      'a[data-notification-item]',
    );
    const target = links?.[activeIndex];
    target?.focus();
  }, [activeIndex, open, items.length]);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/notifications?limit=5', { cache: 'no-store' });
      if (!res.ok) throw new Error('Erreur de chargement des notifications');
      const data = await res.json();
      setItems(data.notifications || []);
    } catch (e) {
      setError('Impossible de charger les notifications. Réessaie plus tard.');
      console.error('Notifications fetch error', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void fetchNotifications();
    }
  }, [open, fetchNotifications]);

  async function markAllRead() {
    try {
      if (!csrfToken) {
        setError('Token CSRF indisponible. Réessaie dans quelques secondes.');
        return;
      }
      const res = await fetch('/api/notifications/read', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'x-csrf': csrfToken },
      });
      if (!res.ok) {
        throw new Error('Erreur lors du marquage des notifications.');
      }
      await fetchNotifications();
      setOpen(false);
    } catch (e) {
      console.error('Notifications mark read error', e);
    }
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="relative h-12 w-12 rounded-full"
        aria-label="Notifications"
        aria-expanded={open}
        aria-controls="notifications-panel"
        onClick={() => {
          setOpen((v) => !v);
          setActiveIndex(0);
        }}
      >
        <Bell className="h-10 w-10" />
        {unread > 0 && (
          <Badge
            variant="danger"
            className="absolute -top-1 -right-1 h-5 w-5 p-0 text-[11px] leading-none flex items-center justify-center"
          >
            {unread > 9 ? '9+' : unread}
          </Badge>
        )}
      </Button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 mt-2 w-80 rounded-2xl border border-border bg-card shadow-card p-3 z-50"
          role="dialog"
          id="notifications-panel"
          aria-label="Notifications"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold">Notifications</span>
            {unread > 0 && (
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={markAllRead}
              >
                Marquer tout comme lu
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fermer"
              className="p-1 rounded-md hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">Chargement...</p>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune notification</p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <li
                  key={item.id}
                  className={cn('py-2', !item.read && 'bg-muted/40 rounded-lg px-2')}
                >
                  <Link
                    href={notificationLink(item, basePath)}
                    className="block focus:outline-none focus:ring-2 focus:ring-primary rounded-lg"
                    data-notification-item
                    id={item.id}
                  >
                    <p className="text-sm font-medium">{notificationTitle(item.type)}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.content?.message || 'Action disponible'}
                    </p>
                    <span className="text-[11px] text-muted-foreground">
                      {formatDate(item.created_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex items-center justify-between text-xs">
            <Link href={`${basePath}/notifications`} className="text-primary hover:underline">
              Voir tout
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function notificationTitle(type: string) {
  switch (type) {
    case 'submission_approved':
      return 'Participation acceptée';
    case 'submission_rejected':
      return 'Participation refusée';
    case 'contest_ending_soon':
      return 'Concours bientôt terminé';
    case 'cashout_completed':
      return 'Retrait effectué';
    default:
      return 'Notification';
  }
}

function notificationLink(item: NotificationItem, basePath: '/app/brand' | '/app/creator') {
  if (item.type === 'submission_approved' || item.type === 'submission_rejected') {
    return basePath === '/app/brand' ? '/app/brand/contests' : '/app/creator/submissions';
  }
  if (item.type === 'cashout_completed') {
    return basePath === '/app/brand' ? '/app/brand/billing' : '/app/creator/wallet';
  }
  return `${basePath}/notifications`;
}
