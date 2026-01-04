'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

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
  const intervalRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/admin/inbox/summary', { cache: 'no-store' });
      if (!res.ok) throw new Error("Impossible de charger l’inbox admin.");
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

  useEffect(() => {
    const poll = () => {
      if (document.visibilityState !== 'visible') return;
      void refresh();
    };

    intervalRef.current = window.setInterval(poll, 30_000);

    const onFocus = () => poll();
    const onVisibility = () => poll();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
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

