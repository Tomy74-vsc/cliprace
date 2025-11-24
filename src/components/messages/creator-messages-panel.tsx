/*
Source: Messaging workspace for creator phase 2
*/
'use client';

import { useCallback, useMemo, useRef, useState, type ChangeEvent } from 'react';
import Link from 'next/link';
import { Paperclip, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToastContext } from '@/hooks/use-toast-context';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase/client';
import { useCsrfToken } from '@/hooks/use-csrf-token';

type ThreadSummary = {
  id: string;
  contestTitle: string | null;
  counterpartName: string | null;
  lastMessage: string | null;
  unread: boolean;
  updated_at: string;
};

type MessageEntry = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  attachments?: { id: string; url: string; mime_type: string | null }[];
};

interface CreatorMessagesPanelProps {
  currentUserId: string;
  initialThreads: ThreadSummary[];
  initialMessages: {
    threadId: string | null;
    messages: MessageEntry[];
  };
}

export function CreatorMessagesPanel({
  currentUserId,
  initialThreads,
  initialMessages,
}: CreatorMessagesPanelProps) {
  const [threads, setThreads] = useState<ThreadSummary[]>(initialThreads);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(
    initialMessages.threadId || initialThreads[0]?.id || null
  );
  const [messagesByThread, setMessagesByThread] = useState<Record<string, MessageEntry[]>>(
    initialMessages.threadId ? { [initialMessages.threadId]: initialMessages.messages } : {}
  );
  const [messageInput, setMessageInput] = useState('');
  const [loadingThread, setLoadingThread] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToastContext();
  const csrfToken = useCsrfToken();
  const MAX_ATTACHMENTS = 3;

  const selectedMessages = selectedThreadId ? messagesByThread[selectedThreadId] : undefined;

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    try {
      const sanitized = files.map((file) => {
        handleFileValidation(file);
        return file;
      });
      setSelectedFiles((prev) => {
        const merged = [...prev, ...sanitized];
        if (merged.length > MAX_ATTACHMENTS) {
          toast({
            type: 'error',
            title: 'Limite atteinte',
            message: `Maximum ${MAX_ATTACHMENTS} fichiers par message.`,
          });
        }
        return merged.slice(0, MAX_ATTACHMENTS);
      });
    } catch (error) {
      toast({
        type: 'error',
        title: 'Pièce jointe refusée',
        message: error instanceof Error ? error.message : 'Format non supporté',
      });
    } finally {
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const fetchMessages = useCallback(
    async (threadId: string) => {
      if (!threadId) return;
      if (messagesByThread[threadId]) return;
      setLoadingThread(threadId);
      try {
        const response = await fetch(`/api/messages/threads/${threadId}/messages`);
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.message || 'Impossible de charger la conversation');
        }
        setMessagesByThread((prev) => ({
          ...prev,
          [threadId]: result.messages || [],
        }));
        setThreads((prev) =>
          prev.map((thread) =>
            thread.id === threadId ? { ...thread, unread: false } : thread
          )
        );
      } catch (error) {
        toast({
          type: 'error',
          title: 'Erreur',
          message: error instanceof Error ? error.message : 'Une erreur est survenue',
        });
      } finally {
        setLoadingThread(null);
      }
    },
    [messagesByThread, toast]
  );

  const handleSelectThread = (threadId: string) => {
    setSelectedThreadId(threadId);
    if (!messagesByThread[threadId]) {
      fetchMessages(threadId);
    } else {
      setThreads((prev) =>
        prev.map((thread) => (thread.id === threadId ? { ...thread, unread: false } : thread))
      );
    }
  };

  const handleSendMessage = async () => {
    if (!selectedThreadId || sending) return;
    if (!messageInput.trim() && selectedFiles.length === 0) {
      toast({ type: 'error', title: 'Message vide', message: 'Ajoutez un texte ou une pièce jointe.' });
      return;
    }
    setSending(true);
    try {
      const attachmentsPayload = selectedFiles.length
        ? await uploadAttachments(selectedThreadId, selectedFiles, csrfToken)
        : [];

      const response = await fetch(`/api/messages/threads/${selectedThreadId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf': csrfToken || '',
        },
        body: JSON.stringify({
          body: messageInput.trim(),
          attachments: attachmentsPayload,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.message_id) {
        throw new Error(result.message || 'Envoi impossible');
      }

      const newMessage: MessageEntry = {
        id: result.message_id,
        sender_id: currentUserId,
        body: messageInput.trim(),
        created_at: new Date().toISOString(),
        attachments:
          attachmentsPayload.length > 0
            ? attachmentsPayload.map((attachment, index) => ({
                id: `${result.message_id}-${index}`,
                url: attachment.url,
                mime_type: attachment.mime_type,
              }))
            : [],
      };

      setMessagesByThread((prev) => ({
        ...prev,
        [selectedThreadId]: [...(prev[selectedThreadId] || []), newMessage],
      }));
      setThreads((prev) => {
        const next = [...prev];
        const index = next.findIndex((thread) => thread.id === selectedThreadId);
        if (index > -1) {
          const thread = { ...next[index] };
          thread.lastMessage = newMessage.body;
          thread.updated_at = newMessage.created_at;
          thread.unread = false;
          next.splice(index, 1);
          next.unshift(thread);
        }
        return next;
      });

      setMessageInput('');
      setSelectedFiles([]);
    } catch (error) {
      toast({
        type: 'error',
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Une erreur est survenue',
      });
    } finally {
      setSending(false);
    }
  };

  const formattedThreads = useMemo(
    () =>
      threads.map((thread) => ({
        ...thread,
        subtitle: thread.contestTitle || 'Concours',
      })),
    [threads]
  );

  if (!threads.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Messages</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Vous n'avez pas encore de conversation. Contactez une marque depuis la fiche d'un concours.
          </p>
          <Button asChild>
            <Link href="/app/creator/discover">Découvrir les concours</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px,1fr] gap-6">
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Conversations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2" role="list" aria-live="polite">
          {formattedThreads.map((thread) => (
            <button
              key={thread.id}
              type="button"
              onClick={() => handleSelectThread(thread.id)}
              className={cn(
                'w-full rounded-lg border px-4 py-3 text-left hover:border-[#635BFF] transition-colors',
                selectedThreadId === thread.id
                  ? 'border-[#635BFF] bg-[#635BFF]/5'
                  : 'border-zinc-200 dark:border-zinc-800'
              )}
              role="listitem"
              aria-pressed={selectedThreadId === thread.id}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium text-foreground truncate">
                  {thread.counterpartName || 'Marque'}
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatRelative(thread.updated_at)}
                </span>
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {thread.subtitle}
              </div>
              <div className="mt-1 text-sm text-foreground line-clamp-2">
                {thread.lastMessage || 'Nouveau fil'}
              </div>
              {thread.unread && (
                <Badge variant="secondary" className="mt-2">
                  Non lu
                </Badge>
              )}
            </button>
          ))}
        </CardContent>
      </Card>

      <Card className="h-full">
        <CardHeader>
          <CardTitle>Messages</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col h-full gap-4">
          <div className="flex-1 space-y-4 overflow-y-auto pr-2" role="region" aria-live="polite">
            {selectedThreadId ? (
              <div className="space-y-3" role="list">
                {loadingThread === selectedThreadId && (
                  <p className="text-sm text-muted-foreground">Chargement…</p>
                )}
                {(selectedMessages || []).map((message) => {
                  const isOwn = message.sender_id === currentUserId;
                  return (
                    <div
                      key={message.id}
                      className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}
                      role="listitem"
                    >
                      <div
                        className={cn(
                          'rounded-lg px-4 py-2 max-w-[75%]',
                          isOwn
                            ? 'bg-[#635BFF] text-white'
                            : 'bg-zinc-100 dark:bg-zinc-900 text-foreground'
                        )}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>
                        <span className="mt-1 block text-[11px] opacity-70">
                          {formatRelative(message.created_at)}
                        </span>
                        {message.attachments && message.attachments.length > 0 && (
                          <div className="mt-2 space-y-2">
                            {message.attachments.map((attachment) => (
                              <a
                                key={attachment.id}
                                href={attachment.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs underline text-white/80 break-words"
                              >
                                {attachmentLabel(attachment.mime_type)}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {!selectedMessages?.length && loadingThread !== selectedThreadId && (
                  <p className="text-sm text-muted-foreground">Aucun message pour le moment.</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Sélectionnez un fil pour afficher la conversation.
              </p>
            )}
          </div>

          <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 space-y-3">
            <Textarea
              placeholder="Écrire un message…"
              value={messageInput}
              onChange={(event) => setMessageInput(event.target.value)}
              disabled={!selectedThreadId || sending}
              aria-label="Message"
            />
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                accept="image/*,application/pdf"
                onChange={(event) => handleFileChange(event)}
                aria-hidden="true"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={!selectedThreadId || sending}
              >
                <Paperclip className="w-4 h-4 mr-2" />
                Joindre
              </Button>
              <div className="flex-1 text-xs text-muted-foreground">
                Formats acceptés : images ou PDF (5 Mo max, 3 fichiers)
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSendMessage} disabled={!selectedThreadId || sending}>
                  {sending ? 'Envoi…' : 'Envoyer'}
                </Button>
              </div>
            </div>
            {selectedFiles.length > 0 && (
              <ul className="space-y-2 text-sm text-muted-foreground" role="list">
                {selectedFiles.map((file, index) => (
                  <li key={`${file.name}-${index}`} className="flex items-center justify-between" role="listitem">
                    <span className="truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeSelectedFile(index)}
                      className="text-xs uppercase text-[#635BFF] hover:underline flex items-center gap-1"
                    >
                      <X className="w-3 h-3" />
                      Retirer
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function formatRelative(value: string): string {
  try {
    const date = new Date(value);
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return value;
  }
}

function attachmentLabel(mime: string | null): string {
  if (!mime) return 'Pièce jointe';
  if (mime.includes('pdf')) return 'Document PDF';
  if (mime.includes('image')) return 'Image';
  return 'Pièce jointe';
}

function handleFileValidation(file: File) {
  const maxSize = 5 * 1024 * 1024;
  const allowed = file.type.startsWith('image/') || file.type === 'application/pdf';
  if (!allowed) {
    throw new Error('Format non supporté (images et PDF uniquement)');
  }
  if (file.size > maxSize) {
    throw new Error('Fichier trop volumineux (max 5 Mo)');
  }
}

async function uploadAttachments(
  threadId: string,
  files: File[],
  csrfToken?: string
): Promise<Array<{ url: string; mime_type: string }>> {
  const uploads: Array<{ url: string; mime_type: string }> = [];
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL manquant');
  }

  for (const file of files) {
    const signResponse = await fetch('/api/uploads/message-attachment/sign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf': csrfToken || '',
      },
      body: JSON.stringify({
        thread_id: threadId,
        filename: file.name,
        mime: file.type || 'application/octet-stream',
        size: file.size,
      }),
    });
    const signResult = await signResponse.json();
    if (!signResponse.ok || !signResult.ok) {
      throw new Error(signResult.message || 'Signature upload impossible');
    }
    const { bucket, path } = signResult;
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      contentType: file.type,
    });
    if (error) {
      throw new Error(error.message);
    }
    const publicUrl = `${baseUrl}/storage/v1/object/public/${bucket}/${path}`;
    uploads.push({ url: publicUrl, mime_type: file.type || 'application/octet-stream' });
  }

  return uploads;
}
