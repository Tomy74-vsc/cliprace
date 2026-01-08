import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { EmptyState } from '@/components/creator/empty-state';
import { ActiveContestsRail, type ActiveContestCard } from '@/components/creator/active-contests-rail';
import type { Platform } from '@/lib/validators/platforms';

export async function ActiveContestsCarousel() {
  const supabase = await getSupabaseSSR();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('contests')
    .select(
      `
        id,
        title,
        cover_url,
        prize_pool_cents,
        currency,
        end_at,
        start_at,
        networks,
        brand:brand_id (
          display_name,
          avatar_url
        )
      `
    )
    .eq('status', 'active')
    .lte('start_at', now)
    .gte('end_at', now)
    .order('end_at', { ascending: true })
    .limit(15);

  if (error) {
    console.error('Active contests fetch error', error);
    return (
      <EmptyState
        title="Impossible de charger les concours"
        description="Réessaie dans quelques instants ou contacte le support si le problème persiste."
        action={{ label: 'Découvrir les concours', href: '/app/creator/contests', variant: 'secondary' }}
      />
    );
  }

  const contests: ActiveContestCard[] =
    data?.map((contest) => ({
      id: contest.id,
      title: contest.title,
      coverUrl: contest.cover_url,
      prizePoolCents: contest.prize_pool_cents,
      currency: contest.currency || 'EUR',
      endAt: contest.end_at,
      networks: (contest.networks as Platform[]) || [],
      brandName: (contest.brand as { display_name?: string | null } | null)?.display_name,
      brandAvatarUrl: (contest.brand as { avatar_url?: string | null } | null)?.avatar_url,
    })) ?? [];

  if (contests.length === 0) {
    return (
      <EmptyState
        title="Aucun concours disponible pour le moment"
        description="Reviens bientôt ou explore tous les concours ouverts."
        action={{ label: 'Découvrir les concours', href: '/app/creator/contests', variant: 'secondary' }}
      />
    );
  }

  return <ActiveContestsRail contests={contests} />;
}

export { ActiveContestsCarouselSkeleton } from './active-contests-rail';
