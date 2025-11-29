import { getSupabaseSSR } from '@/lib/supabase/ssr';

export interface LeaderboardEntry {
  rank: number;
  creator_id: string;
  creator_name: string;
  total_views: number;
  total_weighted_views: number;
}

export async function fetchContestLeaderboard(contestId: string, limit = 5): Promise<LeaderboardEntry[]> {
  const supabase = await getSupabaseSSR();
  const { data, error } = await supabase.rpc('get_contest_leaderboard', { p_contest_id: contestId, p_limit: limit });
  if (error) {
    console.error('Leaderboard fetch error', error);
    return [];
  }

  const creatorIds = Array.from(new Set((data || []).map((row: any) => row.creator_id)));
  const nameMap = new Map<string, string>();
  if (creatorIds.length > 0) {
    const { data: profiles } = await supabase.from('profiles').select('id, display_name').in('id', creatorIds);
    profiles?.forEach((profile: { id: string; display_name: string | null }) => {
      nameMap.set(profile.id, profile.display_name || 'CrÃ©ateur');
    });
  }

  return (
    data?.map((row: any, index: number) => ({
      rank: row.rank ?? index + 1,
      creator_id: row.creator_id as string,
      creator_name: nameMap.get(row.creator_id as string) || 'CrÃ©ateur',
      total_views: row.total_views ?? 0,
      total_weighted_views: row.total_weighted_views ?? 0,
    })) || []
  );
}

