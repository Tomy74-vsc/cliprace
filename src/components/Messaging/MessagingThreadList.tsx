"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { MessagingThread, ThreadPagination } from './types';

interface MessagingThreadListProps {
  activeThreadId?: string;
  onSelect: (thread: MessagingThread) => void;
  limit?: number;
}

function computeIsUnread(
  row: Partial<MessagingThread> & {
    brand_id: string;
    creator_id: string;
    unread_for_brand: boolean;
    unread_for_creator: boolean;
  },
  currentUserId: string | null,
  fallback?: MessagingThread
) {
  if (typeof row.is_unread === 'boolean') {
    return row.is_unread;
  }

  if (currentUserId) {
    if (row.brand_id === currentUserId) {
      return !!row.unread_for_brand;
    }

    if (row.creator_id === currentUserId) {
      return !!row.unread_for_creator;
    }
  }

  if (fallback && typeof fallback.is_unread === 'boolean') {
    return fallback.is_unread;
  }

  return !!row.unread_for_brand || !!row.unread_for_creator;
}

export function MessagingThreadList({ activeThreadId, onSelect, limit = 20 }: MessagingThreadListProps) {
  const supabase = useMemo(() => getBrowserSupabase(), []);
  const [threads, setThreads] = useState<MessagingThread[]>([]);
  const [pagination, setPagination] = useState<ThreadPagination | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  const mapThreadRow = useCallback(
    (
      row: Partial<MessagingThread> & {
        id: string;
        brand_id: string;
        creator_id: string;
        subject: string;
        last_message: string | null;
        unread_for_brand: boolean;
        unread_for_creator: boolean;
        created_at: string;
        updated_at: string;
      },
      fallback?: MessagingThread
    ): MessagingThread => {
      const brand = (row as any).profiles_brand ?? row.brand ?? fallback?.brand ?? null;
      const creator = (row as any).profiles_creator ?? row.creator ?? fallback?.creator ?? null;

      return {
        id: row.id,
        brand_id: row.brand_id,
        creator_id: row.creator_id,
        subject: row.subject,
        last_message: row.last_message ?? fallback?.last_message ?? null,
        unread_for_brand: row.unread_for_brand,
        unread_for_creator: row.unread_for_creator,
        created_at: row.created_at,
        updated_at: row.updated_at,
        brand,
        creator,
        is_unread: computeIsUnread(row, currentUserId, fallback)
      };
    },
    [currentUserId]
  );

  const upsertThread = useCallback(
    (payload: Partial<MessagingThread> & {
      id: string;
      brand_id: string;
      creator_id: string;
      subject: string;
      last_message: string | null;
      unread_for_brand: boolean;
      unread_for_creator: boolean;
      created_at: string;
      updated_at: string;
    }) => {
      setThreads(prev => {
        const index = prev.findIndex(item => item.id === payload.id);
        const nextThread = mapThreadRow(payload, index >= 0 ? prev[index] : undefined);
        const next = index >= 0
          ? prev.map(item => (item.id === payload.id ? { ...item, ...nextThread } : item))
          : [nextThread, ...prev];

        next.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

        setPagination(prevPagination => {
          if (!prevPagination) {
            return null;
          }

          const total = index >= 0
            ? prevPagination.total ?? next.length
            : (prevPagination.total ?? prev.length) + 1;

          const unread_count = next.filter(thread => thread.is_unread).length;

          return {
            ...prevPagination,
            total,
            unread_count
          };
        });

        return next;
      });
    },
    [mapThreadRow]
  );

  const removeThread = useCallback((threadId: string) => {
    setThreads(prev => {
      const next = prev.filter(item => item.id !== threadId);
      if (next.length === prev.length) {
        return prev;
      }

      setPagination(prevPagination => {
        if (!prevPagination) {
          return prevPagination;
        }

        const total = Math.max(0, (prevPagination.total ?? prev.length) - 1);
        const unread_count = next.filter(thread => thread.is_unread).length;

        return {
          ...prevPagination,
          total,
          unread_count
        };
      });

      return next;
    });
  }, []);

  const loadThreads = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/messages?limit=${limit}`);
      if (!response.ok) {
        throw new Error('Impossible de charger les conversations');
      }

      const payload = await response.json();
      const fetchedThreads: MessagingThread[] = payload.data || [];
      setThreads(fetchedThreads);

      const paginationPayload: ThreadPagination | null = payload.pagination || null;
      if (paginationPayload) {
        setPagination(paginationPayload);
      } else {
        setPagination({
          limit,
          offset: 0,
          total: fetchedThreads.length,
          unread_count: fetchedThreads.filter(thread => thread.is_unread).length
        });
      }
    } catch (err) {
      console.error('Erreur chargement conversations:', err);
      setError('Erreur lors du chargement des conversations');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    let mounted = true;

    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mounted) return;

      setCurrentUserId(user.id);

      const newChannel = supabase
        .channel(`messages:threads:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages'
          },
          payload => {
            const row = payload.new as MessagingThread | null;
            if (!row || (row.brand_id !== user.id && row.creator_id !== user.id)) {
              return;
            }
            upsertThread(row);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'messages'
          },
          payload => {
            const row = payload.new as MessagingThread | null;
            if (!row || (row.brand_id !== user.id && row.creator_id !== user.id)) {
              return;
            }
            upsertThread(row);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'messages'
          },
          payload => {
            const row = payload.old as MessagingThread | null;
            if (!row || (row.brand_id !== user.id && row.creator_id !== user.id)) {
              return;
            }
            removeThread(row.id);
          }
        )
        .subscribe();

      setChannel(newChannel);
    };

    setupRealtime();

    return () => {
      mounted = false;
    };
  }, [removeThread, supabase, upsertThread]);

  useEffect(() => {
    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [channel, supabase]);

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-foreground">Messagerie</h2>
          <p className="text-xs text-muted-foreground">
            Conversations brand - creator
            {pagination && (
              <span className="ml-2 text-[11px] text-muted-foreground/70">
                {pagination.unread_count} non lus
              </span>
            )}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={loadThreads} disabled={loading}>
          Actualiser
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto rounded-lg border border-border/60 bg-background/80">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Chargement...
          </div>
        ) : threads.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-sm text-muted-foreground">
            <p>Aucune conversation pour le moment.</p>
            <p className="text-xs">Les échanges entre marque et créateur apparaîtront ici.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border/80">
            {threads.map(thread => {
              const isActive = activeThreadId === thread.id;
              const participant = thread.brand && thread.creator
                ? `${thread.brand?.name || 'Marque'} - ${thread.creator?.name || 'Créateur'}`
                : thread.subject;

              return (
                <li key={thread.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(thread)}
                    className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition hover:bg-muted ${isActive ? 'bg-muted/70' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {thread.subject}
                      </span>
                      {thread.is_unread && (
                        <Badge variant="secondary">Non lu</Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{participant}</span>
                    {thread.last_message && (
                      <p className="line-clamp-2 text-xs text-muted-foreground/80">
                        {thread.last_message}
                      </p>
                    )}
                    <span className="text-[10px] text-muted-foreground/70">
                      {new Date(thread.updated_at).toLocaleString()}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

