/*
Page: Pending live — countdown until contest goes live.
Server Component. Strict ownership check. Only contests in pending_live status.
*/
import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { PendingLiveClient } from './pending-live-client';

export const dynamic = 'force-dynamic';

export default async function PendingLivePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await getSession();
  if (!user) redirect('/auth/login');

  const { id } = await params;
  const supabase = await getSupabaseSSR();

  const { data: contest, error } = await supabase
    .from('contests')
    .select('id, title, status, live_at, brand_id, prize_pool_cents, currency')
    .eq('id', id)
    .eq('brand_id', user.id)
    .maybeSingle();

  if (error || !contest) notFound();

  if (contest.status !== 'pending_live') {
    redirect(`/app/brand/contests/${id}`);
  }

  return (
    <main className="mx-auto max-w-2xl px-4 lg:px-6 py-8">
      <PendingLiveClient
        contestId={id}
        contestTitle={contest.title}
        liveAt={contest.live_at ?? null}
        prizePoolCents={contest.prize_pool_cents}
        currency={contest.currency ?? 'EUR'}
      />
    </main>
  );
}
