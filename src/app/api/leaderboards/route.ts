import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { z } from 'zod';

// Schéma de validation pour les paramètres de requête
const LeaderboardQuerySchema = z.object({
  contest_id: z.string().uuid().optional(),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).default("10"),
  offset: z.string().transform(Number).pipe(z.number().min(0)).default("0"),
});

// Schéma de validation pour la création d'un leaderboard
const CreateLeaderboardSchema = z.object({
  contest_id: z.string().uuid(),
  submission_id: z.string().uuid(),
  rank: z.number().min(1),
  score: z.number().min(0),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = await getServerSupabase();
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // Valider les paramètres de requête
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    const { contest_id, limit, offset } = LeaderboardQuerySchema.parse(queryParams);

    let query = supabase
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
        ),
        contests!inner(
          id,
          title,
          status
        )
      `)
      .order('rank', { ascending: true })
      .range(offset, offset + limit - 1);

    // Filtrer par contest_id si fourni
    if (contest_id) {
      query = query.eq('contest_id', contest_id);
    }

    const { data: leaderboards, error } = await query;

    if (error) {
      console.error('Erreur lors de la récupération des leaderboards:', error);
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }

    // Formater les données pour la réponse
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      },
      contest: {
        id: leaderboard.contests.id,
        title: leaderboard.contests.title,
        status: leaderboard.contests.status
      }
    })) || [];

    return NextResponse.json({
      success: true,
      data: formattedLeaderboards,
      pagination: {
        limit,
        offset,
        total: formattedLeaderboards.length
      }
    });

  } catch (error) {
    console.error('Erreur dans GET /api/leaderboards:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Paramètres invalides', 
        details: error.issues 
      }, { status: 400 });
    }

    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await getServerSupabase();
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // Vérifier que l'utilisateur est admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Accès refusé - Admin requis' }, { status: 403 });
    }

    // Valider les données de la requête
    const body = await request.json();
    const { contest_id, submission_id, rank, score } = CreateLeaderboardSchema.parse(body);

    // Vérifier que le concours et la soumission existent
    const { data: contest } = await supabase
      .from('contests')
      .select('id, status')
      .eq('id', contest_id)
      .single();

    if (!contest) {
      return NextResponse.json({ error: 'Concours non trouvé' }, { status: 404 });
    }

    const { data: submission } = await supabase
      .from('submissions')
      .select('id, status')
      .eq('id', submission_id)
      .single();

    if (!submission) {
      return NextResponse.json({ error: 'Soumission non trouvée' }, { status: 404 });
    }

    // Créer le leaderboard
    const { data: leaderboard, error } = await supabase
      .from('leaderboards')
      .insert({
        contest_id,
        submission_id,
        rank,
        score,
        last_updated: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Erreur lors de la création du leaderboard:', error);
      return NextResponse.json({ error: 'Erreur lors de la création' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: leaderboard
    }, { status: 201 });

  } catch (error) {
    console.error('Erreur dans POST /api/leaderboards:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Données invalides', 
        details: error.issues 
      }, { status: 400 });
    }

    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
