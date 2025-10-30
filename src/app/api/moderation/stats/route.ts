/**
 * API pour les statistiques de modération
 * 
 * Endpoint:
 * - GET /api/moderation/stats - Statistiques des submissions
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Vérifier les permissions
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['admin', 'brand'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Construire la requête selon le rôle
    let query = supabase
      .from('submissions')
      .select('status', { count: 'exact', head: true });

    if (profile.role === 'brand') {
      // Les brands ne peuvent voir que leurs propres contests
      query = query.eq('contests.brand_id', user.id);
    }

    // Récupérer les statistiques par statut
    const statuses = ['pending_automod', 'pending_review', 'approved', 'rejected', 'payout_pending', 'paid'];
    const stats: Record<string, number> = {};

    for (const status of statuses) {
      const { count, error } = await query.eq('status', status);
      if (error) {
        console.error(`Error counting ${status}:`, error);
        stats[status] = 0;
      } else {
        stats[status] = count || 0;
      }
    }

    // Statistiques additionnelles
    const { data: totalSubmissions, error: totalError } = await supabase
      .from('submissions')
      .select('id', { count: 'exact', head: true });

    if (totalError) {
      console.error('Error counting total submissions:', totalError);
    }

    const { data: recentSubmissions, error: recentError } = await supabase
      .from('submissions')
      .select('id, created_at')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    if (recentError) {
      console.error('Error fetching recent submissions:', recentError);
    }

    // Statistiques de la queue de modération
    let queueQuery = supabase
      .from('moderation_queue')
      .select('status', { count: 'exact', head: true });

    if (profile.role === 'brand') {
      queueQuery = queueQuery.eq('submissions.contests.brand_id', user.id);
    }

    const queueStatuses = ['pending', 'processing', 'completed', 'failed'];
    const queueStats: Record<string, number> = {};

    for (const status of queueStatuses) {
      const { count, error } = await queueQuery.eq('status', status);
      if (error) {
        console.error(`Error counting queue ${status}:`, error);
        queueStats[status] = 0;
      } else {
        queueStats[status] = count || 0;
      }
    }

    // Statistiques par plateforme
    const { data: platformStats, error: platformError } = await supabase
      .from('submissions')
      .select('network, status')
      .order('created_at', { ascending: false });

    if (platformError) {
      console.error('Error fetching platform stats:', platformError);
    }

    const platformBreakdown: Record<string, Record<string, number>> = {};
    if (platformStats) {
      for (const submission of platformStats) {
        if (!platformBreakdown[submission.network]) {
          platformBreakdown[submission.network] = {};
        }
        platformBreakdown[submission.network][submission.status] = 
          (platformBreakdown[submission.network][submission.status] || 0) + 1;
      }
    }

    return NextResponse.json({
      data: {
        submissions: {
          ...stats,
          total: totalSubmissions?.length || 0,
          recent_24h: recentSubmissions?.length || 0
        },
        queue: queueStats,
        platforms: platformBreakdown,
        generated_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Moderation stats API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
