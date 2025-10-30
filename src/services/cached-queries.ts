/**
 * Services de requêtes optimisées avec cache
 * Requêtes fréquentes mises en cache pour améliorer les performances
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { withCache, invalidateCache } from '@/lib/cache/redis-cache';
import { cacheConfig } from '@/lib/cache/redis-cache';

/**
 * Service pour les concours avec cache
 */
export class CachedContestService {
  constructor(private supabase: SupabaseClient) {}
  
  /**
   * Récupère tous les concours actifs avec cache
   */
  async getActiveContests() {
    return withCache(
      cacheConfig.keys.contests(),
      async () => {
        const { data, error } = await this.supabase
          .from('contests')
          .select(`
            id,
            title,
            description,
            status,
            total_prize_cents,
            starts_at,
            ends_at,
            visibility,
            profiles!contests_brand_id_fkey(
              id,
              name,
              company_name
            )
          `)
          .eq('status', 'active')
          .eq('visibility', 'public')
          .order('created_at', { ascending: false });
          
        if (error) throw error;
        return data;
      },
      cacheConfig.ttl.contests
    );
  }
  
  /**
   * Récupère un concours spécifique avec cache
   */
  async getContestById(id: string) {
    return withCache(
      cacheConfig.keys.contests(id),
      async () => {
        const { data, error } = await this.supabase
          .from('contests')
          .select(`
            id,
            title,
            description,
            status,
            total_prize_cents,
            starts_at,
            ends_at,
            visibility,
            networks,
            formats,
            hashtags,
            profiles!contests_brand_id_fkey(
              id,
              name,
              company_name
            )
          `)
          .eq('id', id)
          .single();
          
        if (error) throw error;
        return data;
      },
      cacheConfig.ttl.contests
    );
  }
  
  /**
   * Invalide le cache des concours
   */
  async invalidateContestCache(contestId?: string) {
    await invalidateCache('contest', contestId);
  }
}

/**
 * Service pour les leaderboards avec cache
 */
export class CachedLeaderboardService {
  constructor(private supabase: SupabaseClient) {}
  
  /**
   * Récupère le leaderboard d'un concours avec cache
   */
  async getLeaderboardByContest(contestId: string) {
    return withCache(
      cacheConfig.keys.leaderboards(contestId),
      async () => {
        const { data, error } = await this.supabase
          .from('leaderboards')
          .select(`
            id,
            rank,
            score,
            last_updated,
            submissions!inner(
              id,
              views,
              likes,
              comments,
              shares,
              engagement_rate,
              profiles!inner(
                id,
                name,
                handle,
                profile_image_url
              )
            )
          `)
          .eq('contest_id', contestId)
          .order('rank', { ascending: true });
          
        if (error) throw error;
        return data;
      },
      cacheConfig.ttl.leaderboards
    );
  }
  
  /**
   * Invalide le cache des leaderboards
   */
  async invalidateLeaderboardCache(contestId: string) {
    await invalidateCache('contest', contestId);
  }
}

/**
 * Service pour les profils avec cache
 */
export class CachedProfileService {
  constructor(private supabase: SupabaseClient) {}
  
  /**
   * Récupère un profil avec cache
   */
  async getProfileById(id: string) {
    return withCache(
      cacheConfig.keys.profiles(id),
      async () => {
        const { data, error } = await this.supabase
          .from('profiles')
          .select(`
            id,
            name,
            handle,
            email,
            role,
            is_verified,
            is_active,
            profile_image_url,
            created_at,
            profiles_creator(
              bio,
              primary_network,
              followers_total,
              avg_views_30d,
              social_media
            ),
            profiles_brand(
              company_name,
              industry,
              website,
              company_size
            )
          `)
          .eq('id', id)
          .single();
          
        if (error) throw error;
        return data;
      },
      cacheConfig.ttl.profiles
    );
  }
  
  /**
   * Récupère les créateurs populaires avec cache
   */
  async getPopularCreators(limit: number = 10) {
    return withCache(
      `creators:popular:${limit}`,
      async () => {
        const { data, error } = await this.supabase
          .from('profiles_creator')
          .select(`
            user_id,
            bio,
            primary_network,
            followers_total,
            avg_views_30d,
            profiles!inner(
              id,
              name,
              handle,
              profile_image_url,
              is_verified
            )
          `)
          .eq('profiles.is_active', true)
          .eq('profiles.is_verified', true)
          .order('followers_total', { ascending: false })
          .limit(limit);
          
        if (error) throw error;
        return data;
      },
      cacheConfig.ttl.profiles
    );
  }
  
  /**
   * Invalide le cache des profils
   */
  async invalidateProfileCache(profileId?: string) {
    await invalidateCache('profile', profileId);
  }
}

/**
 * Service pour les soumissions avec cache
 */
export class CachedSubmissionService {
  constructor(private supabase: SupabaseClient) {}
  
  /**
   * Récupère les soumissions d'un concours avec cache
   */
  async getSubmissionsByContest(contestId: string, limit: number = 50) {
    return withCache(
      `${cacheConfig.keys.submissions(contestId)}:${limit}`,
      async () => {
        const { data, error } = await this.supabase
          .from('submissions')
          .select(`
            id,
            network,
            video_url,
            thumbnail_url,
            views,
            likes,
            comments,
            shares,
            engagement_rate,
            status,
            created_at,
            profiles!inner(
              id,
              name,
              handle,
              profile_image_url
            )
          `)
          .eq('contest_id', contestId)
          .eq('status', 'approved')
          .order('engagement_rate', { ascending: false })
          .limit(limit);
          
        if (error) throw error;
        return data;
      },
      cacheConfig.ttl.submissions
    );
  }
  
  /**
   * Invalide le cache des soumissions
   */
  async invalidateSubmissionCache(contestId: string) {
    await invalidateCache('contest', contestId);
  }
}

/**
 * Factory pour créer les services avec cache
 */
export function createCachedServices(supabase: SupabaseClient) {
  return {
    contests: new CachedContestService(supabase),
    leaderboards: new CachedLeaderboardService(supabase),
    profiles: new CachedProfileService(supabase),
    submissions: new CachedSubmissionService(supabase),
  };
}
