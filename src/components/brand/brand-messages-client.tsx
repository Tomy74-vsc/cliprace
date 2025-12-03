'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { formatDate } from '@/lib/formatters';
import { MessageSquare, Send, ArrowLeft, Loader2 } from 'lucide-react';
import { useToastContext } from '@/hooks/use-toast-context';
import { cn } from '@/lib/utils';

interface Thread {
  id: string;
  contest_id: string;
  contest_title: string;
  creator_id: string;
  creator_name: string;
  last_message: string | null;
  unread: boolean;
  updated_at: string;
}

interface Message {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  attachments?: Array<{ id: string; url: string; mime_type: string }>;
}

interface BrandMessagesClientProps {
  initialThreads: Thread[];
  userId: string;
}

export function BrandMessagesClient({ initialThreads, userId }: BrandMessagesClientProps) {
  const router = useRouter();
  const { toast } = useToastContext();
  const [threads, setThreads] = useState<Thread[]>(initialThreads);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(
    initialThreads.length > 0 ? initialThreads[0].id : null
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [messageText, setMessageText] = useState('');

  const selectedThread = threads.find((t) => t.id === selectedThreadId);

  // Charger les messages du thread sélectionné
  useEffect(() => {
    if (!selectedThreadId) {
      setMessages([]);
      return;
    }

    setLoading(true);
    fetch(`/api/messages/threads/${selectedThreadId}/messages`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setMessages(data.messages || []);
          // Marquer comme lu
          setThreads((prev) =>
            prev.map((t) => (t.id === selectedThreadId ? { ...t, unread: false } : t))
          );
        }
      })
      .catch((err) => {
        console.error('Messages fetch error', err);
        toast({
          type: 'error',
          title: 'Erreur',
          message: 'Impossible de charger les messages.',
        });
      })
      .finally(() => {
        setLoading(false);
      });
  }, [selectedThreadId, toast]);

  const handleSendMessage = async () => {
    if (!selectedThreadId || !messageText.trim()) return;

    setSending(true);
    try {
      const response = await fetch(`/api/messages/threads/${selectedThreadId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: messageText.trim() }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || 'Erreur lors de l\'envoi');
      }

      // Ajouter le message à la liste
      const newMessage: Message = {
        id: result.message_id,
        sender_id: userId,
        body: messageText.trim(),
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, newMessage]);

      // Mettre à jour le thread
      setThreads((prev) =>
        prev.map((t) =>
          t.id === selectedThreadId
            ? { ...t, last_message: messageText.trim(), updated_at: new Date().toISOString() }
            : t
        )
      );

      setMessageText('');
      router.refresh();
    } catch (error) {
      console.error('Send message error', error);
      toast({
        type: 'error',
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Impossible d\'envoyer le message.',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-[300px,1fr]">
      {/* Liste des threads */}
      <Card>
        <CardHeader>
          <CardTitle>Conversations</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
            {threads.map((thread) => (
              <button
                key={thread.id}
                onClick={() => setSelectedThreadId(thread.id)}
                className={cn(
                  'w-full text-left p-4 hover:bg-muted/50 transition-colors',
                  selectedThreadId === thread.id && 'bg-primary/5 border-l-2 border-primary'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{thread.creator_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{thread.contest_title}</p>
                    {thread.last_message && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {thread.last_message}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(thread.updated_at)}
                    </p>
                  </div>
                  {thread.unread && (
                    <Badge variant="info" className="flex-shrink-0">
                      Nouveau
                    </Badge>
                  )}
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Zone de conversation */}
      {selectedThread ? (
        <Card className="flex flex-col">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{selectedThread.creator_name}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Concours: {selectedThread.contest_title}
                </p>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href={`/app/brand/contests/${selectedThread.contest_id}`}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voir le concours
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col p-0">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[400px]">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <p>Aucun message. Commence la conversation !</p>
                </div>
              ) : (
                messages.map((message) => {
                  const isMe = message.sender_id === userId;
                  return (
                    <div
                      key={message.id}
                      className={cn(
                        'flex',
                        isMe ? 'justify-end' : 'justify-start'
                      )}
                    >
                      <div
                        className={cn(
                          'max-w-[80%] rounded-lg px-4 py-2',
                          isMe
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-foreground'
                        )}
                      >
                        <p className="text-sm whitespace-pre-wrap">{message.body}</p>
                        <p className="text-xs mt-1 opacity-70">
                          {formatDate(message.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Zone de saisie */}
            <div className="border-t p-4 space-y-2">
              <Textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Tape ton message..."
                rows={3}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Appuie sur Cmd/Ctrl + Entrée pour envoyer
                </p>
                <Button onClick={handleSendMessage} disabled={!messageText.trim() || sending}>
                  {sending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Envoi...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Envoyer
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex items-center justify-center h-[600px]">
            <div className="text-center space-y-2">
              <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto" />
              <p className="text-muted-foreground">Sélectionne une conversation</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

