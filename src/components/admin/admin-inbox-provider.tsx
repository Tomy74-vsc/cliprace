'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase/client';

export type AdminInboxSummary = {
  generated_at: string;
  badge_count: number;
  ops: {
    total: number;
    cashouts_pending: number;
    cashouts_oldest_at: string | null;
    moderation_pending: number;
    moderation_oldest_at: string | null;
    webhook_failures_24h: number;
    webhook_failures_1h: number;
    ingestion_errors_24h: number;
    ingestion_errors_1h: number;
    ingestion_jobs_failed: number;
    kyc_pending: number;
    risk_flags_open: number;
    support_open: number;
    support_unassigned: number;
    leads_new: number;
    leads_unassigned: number;
  };
  signals: {
    total: number;
    items: Array<{
      key: string;
      severity: 'info' | 'warning' | 'danger';
      title: string;
      message: string;
      href: string;
      count?: number;
    }>;
  };
};

type AdminInboxContextValue = {
  summary: AdminInboxSummary | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const AdminInboxContext = createContext<AdminInboxContextValue | undefined>(undefined);

export function AdminInboxProvider({
  children,
  initialSummary,
}: {
  children: ReactNode;
  initialSummary?: AdminInboxSummary | null;
}) {
  const [summary, setSummary] = useState<AdminInboxSummary | null>(initialSummary ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/admin/inbox/summary', { cache: 'no-store' });
      if (!res.ok) throw new Error("Impossible de charger l'inbox admin.");
      const data = (await res.json()) as AdminInboxSummary;
      setSummary(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialSummary) return;
    void refresh();
  }, [initialSummary, refresh]);

  // Realtime subscription pour mettre à jour automatiquement l'inbox
  useEffect(() => {
    // Ne pas créer de subscription si on n'a pas de summary initial
    if (!summary && !initialSummary) return;

    const channel = supabase
      .channel('admin_inbox_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cashouts',
          filter: 'status=eq.requested',
        },
        () => {
          // Rafraîchir quand un cashout change
          void refresh();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'submissions',
          filter: 'status=eq.pending',
        },
        () => {
          void refresh();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'admin_tasks',
          filter: 'status=eq.pending',
        },
        () => {
          void refresh();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'moderation_queue',
        },
        () => {
          void refresh();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'webhook_deliveries',
          filter: 'status=eq.failed',
        },
        () => {
          void refresh();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ingestion_errors',
        },
        () => {
          void refresh();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'support_tickets',
          filter: 'status=eq.open',
        },
        () => {
          void refresh();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Admin inbox Realtime subscribed');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Admin inbox Realtime channel error');
          // Fallback sur polling en cas d'erreur Realtime
          const intervalId = window.setInterval(() => {
            if (document.visibilityState === 'visible') {
              void refresh();
            }
          }, 30_000);
          return () => window.clearInterval(intervalId);
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refresh, summary, initialSummary]);

  // Fallback polling si Realtime n'est pas disponible (seulement quand la page est visible)
  useEffect(() => {
    // Utiliser un interval plus long (5 minutes) comme fallback
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refresh();
      }
    }, 300_000); // 5 minutes

    return () => window.clearInterval(intervalId);
  }, [refresh]);

  const value = useMemo<AdminInboxContextValue>(() => ({ summary, loading, error, refresh }), [summary, loading, error, refresh]);

  return <AdminInboxContext.Provider value={value}>{children}</AdminInboxContext.Provider>;
}

export function useAdminInbox() {
  const ctx = useContext(AdminInboxContext);
  if (!ctx) throw new Error('useAdminInbox must be used within AdminInboxProvider');
  return ctx;
}

export function useAdminInboxOptional() {
  const ctx = useContext(AdminInboxContext);
  return ctx ?? null;
}

