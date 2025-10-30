/**
 * Optimiseur de requêtes Supabase pour ClipRace
 * Sélection spécifique des champs pour améliorer les performances
 */

import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Sélections optimisées pour les différentes entités
 */
export const optimizedSelects = {
  // Sélection minimale pour les listes
  contestList: `
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
  `,
  
  // Sélection complète pour les détails
  contestDetail: `
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
    created_at,
    updated_at,
    profiles!contests_brand_id_fkey(
      id,
      name,
      company_name,
      profiles_brand(
        industry,
        company_size
      )
    )
  `,
  
  // Sélection pour les soumissions
  submissionList: `
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
  `,
  
  // Sélection pour les leaderboards
  leaderboardEntry: `
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
  `,
  
  // Sélection pour les profils
  profileBasic: `
    id,
    name,
    handle,
    role,
    is_verified,
    is_active,
    profile_image_url
  `,
  
  profileComplete: `
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
  `,
  
  // Sélection pour les métriques
  metricsBasic: `
    id,
    views,
    likes,
    comments,
    shares,
    engagement_rate,
    last_metrics_fetch
  `,
};

/**
 * Classe pour optimiser les requêtes Supabase
 */
export class QueryOptimizer {
  constructor(private supabase: SupabaseClient) {}
  
  /**
   * Récupère les concours actifs avec sélection optimisée
   */
  async getActiveContests(limit: number = 20) {
    const { data, error } = await this.supabase
      .from('contests')
      .select(optimizedSelects.contestList)
      .eq('status', 'active')
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .limit(limit);
      
    if (error) throw error;
    return data;
  }
  
  /**
   * Récupère un concours avec tous les détails
   */
  async getContestById(id: string) {
    const { data, error } = await this.supabase
      .from('contests')
      .select(optimizedSelects.contestDetail)
      .eq('id', id)
      .single();
      
    if (error) throw error;
    return data;
  }
  
  /**
   * Récupère les soumissions d'un concours avec pagination
   */
  async getContestSubmissions(
    contestId: string, 
    limit: number = 50, 
    offset: number = 0
  ) {
    const { data, error } = await this.supabase
      .from('submissions')
      .select(optimizedSelects.submissionList)
      .eq('contest_id', contestId)
      .eq('status', 'approved')
      .order('engagement_rate', { ascending: false })
      .range(offset, offset + limit - 1);
      
    if (error) throw error;
    return data;
  }
  
  /**
   * Récupère le leaderboard d'un concours
   */
  async getContestLeaderboard(contestId: string) {
    const { data, error } = await this.supabase
      .from('leaderboards')
      .select(optimizedSelects.leaderboardEntry)
      .eq('contest_id', contestId)
      .order('rank', { ascending: true });
      
    if (error) throw error;
    return data;
  }
  
  /**
   * Récupère un profil avec informations complètes
   */
  async getProfileById(id: string) {
    const { data, error } = await this.supabase
      .from('profiles')
      .select(optimizedSelects.profileComplete)
      .eq('id', id)
      .single();
      
    if (error) throw error;
    return data;
  }
  
  /**
   * Récupère les créateurs populaires avec pagination
   */
  async getPopularCreators(limit: number = 10, offset: number = 0) {
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
      .range(offset, offset + limit - 1);
      
    if (error) throw error;
    return data;
  }
  
  /**
   * Recherche de concours avec filtres optimisés
   */
  async searchContests(
    query: string,
    filters: {
      status?: string;
      visibility?: string;
      networks?: string[];
    } = {},
    limit: number = 20
  ) {
    let queryBuilder = this.supabase
      .from('contests')
      .select(optimizedSelects.contestList)
      .textSearch('title', query)
      .limit(limit);
    
    // Appliquer les filtres
    if (filters.status) {
      queryBuilder = queryBuilder.eq('status', filters.status);
    }
    
    if (filters.visibility) {
      queryBuilder = queryBuilder.eq('visibility', filters.visibility);
    }
    
    if (filters.networks && filters.networks.length > 0) {
      queryBuilder = queryBuilder.overlaps('networks', filters.networks);
    }
    
    const { data, error } = await queryBuilder;
    if (error) throw error;
    return data;
  }
  
  /**
   * Récupère les métriques d'une soumission
   */
  async getSubmissionMetrics(submissionId: string) {
    const { data, error } = await this.supabase
      .from('submissions')
      .select(optimizedSelects.metricsBasic)
      .eq('id', submissionId)
      .single();
      
    if (error) throw error;
    return data;
  }
  
  /**
   * Récupère les statistiques globales (pour le dashboard)
   */
  async getGlobalStats() {
    const [contestsCount, submissionsCount, creatorsCount] = await Promise.all([
      this.supabase
        .from('contests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active'),
        
      this.supabase
        .from('submissions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'approved'),
        
      this.supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'creator')
        .eq('is_active', true)
    ]);
    
    return {
      activeContests: contestsCount.count || 0,
      approvedSubmissions: submissionsCount.count || 0,
      activeCreators: creatorsCount.count || 0,
    };
  }
}

/**
 * Factory pour créer l'optimiseur de requêtes
 */
export function createQueryOptimizer(supabase: SupabaseClient) {
  return new QueryOptimizer(supabase);
}

/**
 * Hook pour utiliser l'optimiseur dans les composants
 */
export function useQueryOptimizer(supabase: SupabaseClient) {
  return createQueryOptimizer(supabase);
}
