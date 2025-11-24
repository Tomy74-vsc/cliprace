/*
Notifications dropdown : affiche les notifs non lues + accès page liste.
*/
'use client';

import Link from 'next/link';
import { Bell, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type NotificationItem = {
  id: string;
  type: string;
  content: Record<string, string>;
  created_at: string;
  read: boolean;
};

export function NotificationsDropdown() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const unread = items.filter((n) => !n.read).length;
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void fetchNotifications();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  async function fetchNotifications() {
    try {
      const res = await fetch('/api/notifications?limit=5', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.notifications || []);
    } catch (e) {
      console.error('Notifications fetch error', e);
    }
  }

  async function markAllRead() {
    try {
      await fetch('/api/notifications/read', { method: 'POST' });
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
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
        className="relative h-10 w-10 rounded-full"
        aria-label="Notifications"
        aria-expanded={open}
        aria-controls="notifications-panel"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-5 w-5" />
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
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune notification</p>
          ) : (
            <ul className="divide-y divide-border" role="list">
              {items.map((item) => (
                <li key={item.id} className={cn('py-2', !item.read && 'bg-muted/40 rounded-lg px-2')}>
                  <Link href={notificationLink(item)} className="block">
                    <p className="text-sm font-medium">{notificationTitle(item.type)}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.content?.message || 'Action disponible'}
                    </p>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(item.created_at).toLocaleDateString('fr-FR')}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex items-center justify-between text-xs">
            <Link href="/app/creator/notifications" className="text-primary hover:underline">
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

function notificationLink(item: NotificationItem) {
  if (item.type === 'submission_approved' || item.type === 'submission_rejected') {
    return '/app/creator/submissions';
  }
  if (item.type === 'cashout_completed') {
    return '/app/creator/wallet';
  }
  return '/app/creator/notifications';
}
