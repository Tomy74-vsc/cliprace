/*
Page: Brand messages
Objectifs: liste des threads avec créateurs, conversations, envoi de messages
*/
import { getSession } from '@/lib/auth';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BrandEmptyState } from '@/components/brand/empty-state-enhanced';
import { formatDate } from '@/lib/formatters';
import { MessageSquare, Send, ArrowLeft } from 'lucide-react';
import { TrackOnView } from '@/components/analytics/track-once';
import { BrandMessagesClient } from '@/components/brand/brand-messages-client';
import Link from 'next/link';

export const revalidate = 30;

export default async function BrandMessagesPage() {
  const { user } = await getSession();
  if (!user) return null;

  const { threads, error } = await fetchThreads(user.id);

  if (error) {
    return (
      <main className="space-y-6">
        <BrandEmptyState
          type="default"
          title="Erreur de chargement"
          description="Impossible de charger les messages. Réessaie plus tard."
          action={{ label: 'Réessayer', href: '/app/brand/messages', variant: 'secondary' }}
        />
      </main>
    );
  }

  return (
    <main className="space-y-8">
      <TrackOnView event="view_brand_messages" payload={{ threads_count: threads.length }} />

      {/* En-tête */}
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">Messages</h1>
        <p className="text-muted-foreground">
          Communique avec les créateurs qui participent à tes concours.
        </p>
      </div>

      {threads.length === 0 ? (
        <BrandEmptyState
          type="no-messages"
          title="Aucun message"
          description="Tu n'as pas encore de conversation avec des créateurs. Les messages apparaîtront ici une fois qu'un créateur t'aura contacté ou que tu auras initié une conversation."
          action={{
            label: 'Voir mes concours',
            href: '/app/brand/contests',
            variant: 'secondary',
          }}
        />
      ) : (
        <BrandMessagesClient initialThreads={threads} userId={user.id} />
      )}
    </main>
  );
}

async function fetchThreads(userId: string) {
  const supabase = await getSupabaseSSR();

  // Récupérer les threads où la marque est brand_id
  const { data: threadsData, error } = await supabase
    .from('messages_threads')
    .select(
      'id, contest_id, creator_id, last_message, unread_for_brand, updated_at, contest:contest_id(title), creator:creator_id(display_name)'
    )
    .eq('brand_id', userId)
    .order('updated_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Threads fetch error', error);
    return { error: 'Failed to fetch threads', threads: [] };
  }

  const threads = (threadsData || []).map((thread) => ({
    id: thread.id,
    contest_id: thread.contest_id,
    contest_title: (thread.contest as { title?: string | null } | null)?.title || 'Concours',
    creator_id: thread.creator_id,
    creator_name: (thread.creator as { display_name?: string | null } | null)?.display_name || 'Créateur',
    last_message: thread.last_message,
    unread: thread.unread_for_brand || false,
    updated_at: thread.updated_at,
  }));

  return { threads, error: null };
}

