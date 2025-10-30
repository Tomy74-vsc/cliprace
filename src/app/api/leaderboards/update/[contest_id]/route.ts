import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { z } from 'zod';

// Schéma de validation pour les paramètres de route
const ContestIdSchema = z.string().uuid();

export async function POST(
  request: NextRequest,
  { params }: { params: { contest_id: string } }
) {
  try {
    const supabase = await getServerSupabase();
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // Valider le contest_id
    const contest_id = ContestIdSchema.parse(params.contest_id);

    // Vérifier que l'utilisateur est admin ou propriétaire du concours
    const { data: contest } = await supabase
      .from('contests')
      .select('id, brand_id, status')
      .eq('id', contest_id)
      .single();

    if (!contest) {
      return NextResponse.json({ error: 'Concours non trouvé' }, { status: 404 });
    }

    // Vérifier les permissions
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = profile?.role === 'admin';
    const isOwner = contest.brand_id === user.id;

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    // Appeler la fonction de mise à jour du classement
    const { data, error } = await supabase.rpc('update_contest_leaderboard', {
      p_contest_id: contest_id
    });

    if (error) {
      console.error('Erreur lors de la mise à jour du classement:', error);
      return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 });
    }

    // Récupérer le nouveau classement
    const { data: leaderboards, error: fetchError } = await supabase
      .from('leaderboards')
      .select(`
        id,
        contest_id,
        submission_id,
        rank,
        score,
        last_updated,
        submissions!inner(
          id,
          creator_id,
          video_url,
          platform,
          platform_video_id,
          status,
          created_at,
          profiles!inner(
            id,
            name,
            handle,
            profile_image_url
          )
        )
      `)
      .eq('contest_id', contest_id)
      .order('rank', { ascending: true });

    if (fetchError) {
      console.error('Erreur lors de la récupération du classement:', fetchError);
      return NextResponse.json({ error: 'Erreur lors de la récupération' }, { status: 500 });
    }

    // Formater les données
    const formattedLeaderboards = leaderboards?.map((leaderboard: any) => ({
      id: leaderboard.id,
      contest_id: leaderboard.contest_id,
      submission_id: leaderboard.submission_id,
      rank: leaderboard.rank,
      score: leaderboard.score,
      last_updated: leaderboard.last_updated,
      submission: {
        id: leaderboard.submissions.id,
        creator_id: leaderboard.submissions.creator_id,
        video_url: leaderboard.submissions.video_url,
        platform: leaderboard.submissions.platform,
        platform_video_id: leaderboard.submissions.platform_video_id,
        status: leaderboard.submissions.status,
        created_at: leaderboard.submissions.created_at,
        creator: leaderboard.submissions.profiles
      }
    })) || [];

    return NextResponse.json({
      success: true,
      message: 'Classement mis à jour avec succès',
      data: formattedLeaderboards,
      contest_id,
      updated_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Erreur dans POST /api/leaderboards/update/[contest_id]:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Paramètres invalides', 
        details: error.issues 
      }, { status: 400 });
    }

    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
