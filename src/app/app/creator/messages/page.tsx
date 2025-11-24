import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { CreatorMessagesPanel } from '@/components/messages/creator-messages-panel';

interface SearchParams {
  thread?: string;
}

export default async function CreatorMessagesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { user, error } = await getSession();
  if (error || !user) {
    redirect('/auth/login');
  }

  const supabase = getSupabaseSSR();
  const { data: threadRows } = await supabase
    .from('messages_threads')
    .select(
      `
      id,
      contest_id,
      last_message,
      unread_for_creator,
      unread_for_brand,
      updated_at,
      contest:contest_id (
        title
      ),
      brand:brand_id (
        id,
        display_name
      ),
      creator:creator_id (
        id,
        display_name
      )
    `
    )
    .or(`brand_id.eq.${user.id},creator_id.eq.${user.id}`)
    .order('updated_at', { ascending: false })
    .limit(30);

  const threads =
    threadRows?.map((thread) => {
      const counterpartName =
        thread.brand?.id === user.id ? thread.creator?.display_name : thread.brand?.display_name;
      const unread =
        thread.creator?.id === user.id ? thread.unread_for_creator : thread.unread_for_brand;
      return {
        id: thread.id,
        contestTitle: thread.contest?.title ?? null,
        counterpartName: counterpartName ?? null,
        lastMessage: thread.last_message ?? null,
        unread: Boolean(unread),
        updated_at: thread.updated_at,
      };
    }) ?? [];

  const requestedThreadId = searchParams.thread || null;
  const initialThreadId =
    requestedThreadId && threads.some((thread) => thread.id === requestedThreadId)
      ? requestedThreadId
      : threads[0]?.id ?? null;

  const { data: initialMessages } = initialThreadId
    ? await supabase
        .from('messages')
        .select('id, sender_id, body, created_at')
        .eq('thread_id', initialThreadId)
        .order('created_at', { ascending: true })
        .limit(100)
    : { data: [] };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <p className="text-sm text-muted-foreground">
          Échangez avec les marques qui gèrent vos concours.
        </p>
      </div>
      <CreatorMessagesPanel
        currentUserId={user.id}
        initialThreads={threads}
        initialMessages={{
          threadId: initialThreadId,
          messages: initialMessages || [],
        }}
      />
    </main>
  );
}
