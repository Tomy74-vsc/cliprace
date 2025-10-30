"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getBrowserSupabase } from '@/lib/supabase/client';
import type { MessagingAttachment, MessagingMessage, MessagingThread, MessagePagination } from './types';
import { MessagingComposer } from './MessagingComposer';
import { FlagMessageModal } from './FlagMessageModal';

interface MessagingThreadViewProps {
  thread: MessagingThread | null;
  onMessageSent?: (message: MessagingMessage) => void;
}

function normalizeAttachments(value: unknown): MessagingAttachment[] {
  if (Array.isArray(value)) {
    return value as MessagingAttachment[];
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as MessagingAttachment[]) : [];
    } catch {
      return [];
    }
  }

  return [];
}

export function MessagingThreadView({ thread, onMessageSent }: MessagingThreadViewProps) {
  const supabase = useMemo(() => getBrowserSupabase(), []);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessagingMessage[]>([]);
  const [pagination, setPagination] = useState<MessagePagination | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [flagTarget, setFlagTarget] = useState<MessagingMessage | null>(null);
  const [flagReason, setFlagReason] = useState('');
  const [flagSubmitting, setFlagSubmitting] = useState(false);
  const [flagError, setFlagError] = useState<string | null>(null);
  const flagReasonRef = useRef<HTMLTextAreaElement | null>(null);

  const threadId = thread?.id;

  const fetchViewer = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  }, [supabase]);

  const mapMessageRow = useCallback(
    (
      row: Partial<MessagingMessage> & {
        id: string;
        thread_id: string;
        sender_id: string;
        body: string | null;
        attachments?: unknown;
        flagged?: boolean;
        flagged_at?: string | null;
        flagged_by?: string | null;
        flagged_reason?: string | null;
        created_at: string;
      },
      fallback?: MessagingMessage
    ): MessagingMessage => {
      const attachments = row.attachments !== undefined
        ? normalizeAttachments(row.attachments)
        : fallback?.attachments ?? [];

      const sender = (row as any).profiles
        || (row as any).sender
        || fallback?.sender
        || (thread?.brand_id === row.sender_id ? thread?.brand ?? null : null)
        || (thread?.creator_id === row.sender_id ? thread?.creator ?? null : null);

      const isFromCurrentUser = currentUserId ? row.sender_id === currentUserId : fallback?.is_from_current_user ?? false;

      return {
        id: row.id,
        thread_id: row.thread_id,
        sender_id: row.sender_id,
        body: row.body ?? fallback?.body ?? '',
        attachments,
        flagged: row.flagged ?? fallback?.flagged ?? false,
        flagged_at: row.flagged_at ?? fallback?.flagged_at ?? null,
        flagged_by: row.flagged_by ?? fallback?.flagged_by ?? null,
        flagged_reason: row.flagged_reason ?? fallback?.flagged_reason ?? null,
        created_at: row.created_at,
        sender,
        is_from_current_user: isFromCurrentUser
      };
    },
    [currentUserId, thread?.brand, thread?.brand_id, thread?.creator, thread?.creator_id]
  );

  const loadMessages = useCallback(async () => {
    if (!threadId) {
      setMessages([]);
      setPagination(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/messages/${threadId}?limit=100`);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: 'Impossible de rÃ©cupÃ©rer les messages.' }));
        throw new Error(payload.error || 'Impossible de rÃ©cupÃ©rer les messages');
      }
      const payload = await response.json();
      const fetched: MessagingMessage[] = (payload.data || []).map((item: MessagingMessage) => mapMessageRow(item));
      setMessages(fetched);
      setPagination(payload.pagination || {
        limit: 100,
        offset: 0,
        total: fetched.length
      });
    } catch (err) {
      console.error('Erreur chargement messages:', err);
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, [mapMessageRow, threadId]);

  useEffect(() => {
    fetchViewer();
  }, [fetchViewer]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!threadId) {
      return undefined;
    }

    const channel = supabase
      .channel(`messages_thread:${threadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages_thread',
          filter: `thread_id=eq.${threadId}`
        },
        payload => {
          const row = payload.new as MessagingMessage | null;
          if (!row) return;

          setMessages(prev => {
            if (prev.some(item => item.id === row.id)) {
              return prev;
            }

            const nextMessage = mapMessageRow(row);
            const next = [...prev, nextMessage];

            setPagination(prevPagination => {
              if (!prevPagination) {
                return prevPagination;
              }
              return {
                ...prevPagination,
                total: (prevPagination.total ?? prev.length) + 1
              };
            });

            return next;
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages_thread',
          filter: `thread_id=eq.${threadId}`
        },
        payload => {
          const row = payload.new as MessagingMessage | null;
          if (!row) return;

          setMessages(prev => prev.map(item => (item.id === row.id ? mapMessageRow(row, item) : item)));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages_thread',
          filter: `thread_id=eq.${threadId}`
        },
        payload => {
          const row = payload.old as MessagingMessage | null;
          if (!row) return;

          setMessages(prev => {
            if (!prev.some(item => item.id === row.id)) {
              return prev;
            }

            const next = prev.filter(item => item.id !== row.id);

            setPagination(prevPagination => {
              if (!prevPagination) {
                return prevPagination;
              }
              return {
                ...prevPagination,
                total: Math.max(0, (prevPagination.total ?? prev.length) - 1)
              };
            });

            return next;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [mapMessageRow, supabase, threadId]);

  useEffect(() => {
    if (!flagTarget) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setFlagTarget(null);
        setFlagReason('');
        setFlagError(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [flagTarget]);

  useEffect(() => {
    if (flagTarget) {
      flagReasonRef.current?.focus();
    }
  }, [flagTarget]);

  const handleMessageSent = (message: MessagingMessage) => {
    setMessages(prev => {
      if (prev.some(item => item.id === message.id)) {
        return prev;
      }
      const next = [...prev, message];
      setPagination(prevPagination => {
        if (!prevPagination) {
          return prevPagination;
        }
        return {
          ...prevPagination,
          total: (prevPagination.total ?? prev.length) + 1
        };
      });
      return next;
    });
    onMessageSent?.(message);
  };

  const handleDownload = async (attachment: MessagingAttachment) => {
    try {
      setDownloading(attachment.id);
      const { data, error: storageError } = await supabase.storage
        .from(attachment.bucket)
        .createSignedUrl(attachment.path, 60);

      if (storageError || !data) {
        throw storageError || new Error('Impossible de rÃ©cupÃ©rer la piÃ¨ce jointe');
      }

      window.open(data.signedUrl, '_blank', 'noopener');
    } catch (err) {
      console.error('Erreur tÃ©lÃ©chargement piÃ¨ce jointe:', err);
      setError('Impossible de tÃ©lÃ©charger la piÃ¨ce jointe');
    } finally {
      setDownloading(null);
    }
  };

  const openFlagDialog = (message: MessagingMessage) => {
    setFlagTarget(message);
    setFlagReason(message.flagged_reason || '');
    setFlagError(null);
  };

  const handleConfirmFlag = async () => {
    if (!threadId || !flagTarget) {
      return;
    }

    try {
      setFlagSubmitting(true);
      setFlagError(null);

      const response = await fetch(`/api/messages/${threadId}/flag`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message_id: flagTarget.id,
          reason: flagReason.trim() ? flagReason : undefined
        })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: 'Signalement impossible.' }));
        throw new Error(payload.error || 'Impossible de signaler le message');
      }

      const payload = await response.json();
      const updated = payload.data as MessagingMessage;

      setMessages(prev => prev.map(item => (
        item.id === updated.id
          ? {
              ...item,
              flagged: updated.flagged,
              flagged_at: updated.flagged_at,
              flagged_by: updated.flagged_by,
              flagged_reason: updated.flagged_reason
            }
          : item
      )));

      setFlagTarget(null);
      setFlagReason('');
      setFlagError(null);
    } catch (err) {
      console.error('Erreur signalement message:', err);
      setFlagError(err instanceof Error ? err.message : 'Erreur lors du signalement');
    } finally {
      setFlagSubmitting(false);
    }
  };

  const isBrand = currentUserId && thread ? currentUserId === thread.brand_id : false;

  if (!threadId) {
    return (
      <div className="flex h-full flex-1 items-center justify-center rounded-lg border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
        SÃ©lectionnez une conversation pour afficher les messages.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-lg border border-border/60 bg-background/80 p-4">
      <header className="flex flex-col gap-1 border-b border-border/60 pb-3">
        <h3 className="text-lg font-semibold text-foreground">{thread.subject}</h3>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {thread.brand?.name && <span>Marque : {thread.brand.name}</span>}
          {thread.creator?.name && <span>CrÃ©ateur : {thread.creator.name}</span>}
          <span>DerniÃ¨re mise Ã  jour : {new Date(thread.updated_at).toLocaleString()}</span>
        </div>
      </header>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      <div className="flex-1 space-y-4 overflow-y-auto pr-2">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Chargement...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
            DÃ©marrez la conversation avec un premier message.
          </div>
        ) : (
          messages.map(message => {
            const isMine = message.is_from_current_user;
            return (
              <div
                key={message.id}
                className={`flex flex-col gap-2 rounded-lg border border-border/60 px-4 py-3 shadow-sm ${isMine ? 'ml-auto max-w-[80%] bg-primary/10' : 'mr-auto max-w-[80%] bg-muted/60'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-foreground">
                    {message.sender?.name || (isMine ? 'Vous' : 'Participant')}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(message.created_at).toLocaleString()}
                  </span>
                </div>

                {message.flagged && (
                  <Badge variant="destructive" className="w-fit text-[10px]">
                    SignalÃ© par la marque
                  </Badge>
                )}

                {message.body && (
                  <p className="whitespace-pre-line text-sm text-foreground/90">
                    {message.body}
                  </p>
                )}

                {message.attachments && message.attachments.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">PiÃ¨ces jointes</span>
                    <ul className="flex flex-wrap gap-2">
                      {message.attachments.map(attachment => (
                        <li key={attachment.id}>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownload(attachment)}
                            disabled={downloading === attachment.id}
                            className="text-xs"
                          >
                            {downloading === attachment.id ? 'TÃ©lÃ©chargement...' : attachment.name}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {isBrand && !message.flagged && (
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openFlagDialog(message)}
                      className="text-xs"
                    >
                      Signaler
                    </Button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <MessagingComposer threadId={threadId} onSent={handleMessageSent} />

      {flagTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="flag-dialog-title"
            className="w-full max-w-md rounded-lg border border-border/60 bg-background p-6 shadow-xl"
          >
            <div className="mb-4">
              <h2 id="flag-dialog-title" className="text-lg font-semibold text-foreground">
                Signaler ce message
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Expliquez la raison du signalement pour aider l'Ã©quipe de modÃ©ration.
              </p>
            </div>

            <label className="flex flex-col gap-2 text-sm text-foreground">
              Motif (optionnel)
              <textarea
                ref={flagReasonRef}
                rows={4}
                value={flagReason}
                onChange={event => setFlagReason(event.target.value)}
                className="w-full resize-none rounded-md border border-border/60 bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </label>

            {flagError && (
              <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {flagError}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setFlagTarget(null);
                  setFlagReason('');
                  setFlagError(null);
                }}
              >
                Annuler
              </Button>
              <Button type="button" onClick={handleConfirmFlag} disabled={flagSubmitting}>
                {flagSubmitting ? 'Envoi...' : 'Confirmer'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
