import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { z } from 'zod';

// Schéma de validation pour les paramètres de requête
const TestFunctionSchema = z.object({
  function_name: z.enum(['calculate_submission_score', 'update_contest_leaderboard']),
  submission_id: z.string().uuid().optional(),
  contest_id: z.string().uuid().optional(),
});

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
    const { function_name, submission_id, contest_id } = TestFunctionSchema.parse(body);

    let result;
    let error;

    switch (function_name) {
      case 'calculate_submission_score':
        if (!submission_id) {
          return NextResponse.json({ error: 'submission_id requis pour calculate_submission_score' }, { status: 400 });
        }

        // Vérifier que la soumission existe
        const { data: submission } = await supabase
          .from('submissions')
          .select('id, status')
          .eq('id', submission_id)
          .single();

        if (!submission) {
          return NextResponse.json({ error: 'Soumission non trouvée' }, { status: 404 });
        }

        // Tester la fonction
        const { data: scoreResult, error: scoreError } = await supabase.rpc('calculate_submission_score', {
          p_submission_id: submission_id
        });

        result = {
          function_name: 'calculate_submission_score',
          submission_id,
          score: scoreResult,
          submission_status: submission.status
        };
        error = scoreError;
        break;

      case 'update_contest_leaderboard':
        if (!contest_id) {
          return NextResponse.json({ error: 'contest_id requis pour update_contest_leaderboard' }, { status: 400 });
        }

        // Vérifier que le concours existe
        const { data: contest } = await supabase
          .from('contests')
          .select('id, status, title')
          .eq('id', contest_id)
          .single();

        if (!contest) {
          return NextResponse.json({ error: 'Concours non trouvé' }, { status: 404 });
        }

        // Compter les soumissions avant la mise à jour
        const { count: submissionsBefore } = await supabase
          .from('submissions')
          .select('*', { count: 'exact', head: true })
          .eq('contest_id', contest_id)
          .eq('status', 'approved');

        // Compter les entrées de leaderboard avant la mise à jour
        const { count: leaderboardBefore } = await supabase
          .from('leaderboards')
          .select('*', { count: 'exact', head: true })
          .eq('contest_id', contest_id);

        // Tester la fonction
        const { error: updateError } = await supabase.rpc('update_contest_leaderboard', {
          p_contest_id: contest_id
        });

        // Compter les entrées de leaderboard après la mise à jour
        const { count: leaderboardAfter } = await supabase
          .from('leaderboards')
          .select('*', { count: 'exact', head: true })
          .eq('contest_id', contest_id);

        // Récupérer le nouveau classement
        const { data: newLeaderboard } = await supabase
          .from('leaderboards')
          .select(`
            id,
            rank,
            score,
            submissions!inner(
              id,
              creator_id,
              platform,
              profiles!inner(
                name,
                handle
              )
            )
          `)
          .eq('contest_id', contest_id)
          .order('rank', { ascending: true })
          .limit(5);

        result = {
          function_name: 'update_contest_leaderboard',
          contest_id,
          contest_title: contest.title,
          contest_status: contest.status,
          submissions_count: submissionsBefore,
          leaderboard_before: leaderboardBefore,
          leaderboard_after: leaderboardAfter,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          top_5_leaderboard: newLeaderboard?.map((item: any) => ({
            rank: item.rank,
            score: item.score,
            creator_name: item.submissions.profiles.name,
            creator_handle: item.submissions.profiles.handle,
            platform: item.submissions.platform
          })) || []
        };
        error = updateError;
        break;

      default:
        return NextResponse.json({ error: 'Fonction non supportée' }, { status: 400 });
    }

    if (error) {
      console.error(`Erreur lors du test de ${function_name}:`, error);
      return NextResponse.json({ 
        error: `Erreur lors du test de ${function_name}`,
        details: error.message,
        result 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Test de ${function_name} réussi`,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Erreur dans POST /api/test-functions:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Données invalides', 
        details: error.issues 
      }, { status: 400 });
    }

    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function GET() {
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

    // Récupérer des informations sur les fonctions disponibles
    const { data: functions } = await supabase
      .from('information_schema.routines')
      .select('routine_name, routine_type')
      .eq('routine_schema', 'public')
      .in('routine_name', ['calculate_submission_score', 'update_contest_leaderboard']);

    // Récupérer des statistiques sur les tables
    const { count: submissionsCount } = await supabase
      .from('submissions')
      .select('*', { count: 'exact', head: true });

    const { count: contestsCount } = await supabase
      .from('contests')
      .select('*', { count: 'exact', head: true });

    const { count: leaderboardsCount } = await supabase
      .from('leaderboards')
      .select('*', { count: 'exact', head: true });

    const { count: metricsCount } = await supabase
      .from('metrics_daily')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      success: true,
      data: {
        available_functions: functions || [],
        database_stats: {
          submissions: submissionsCount || 0,
          contests: contestsCount || 0,
          leaderboards: leaderboardsCount || 0,
          metrics_daily: metricsCount || 0
        },
        test_endpoints: {
          calculate_submission_score: 'POST /api/test-functions avec { "function_name": "calculate_submission_score", "submission_id": "uuid" }',
          update_contest_leaderboard: 'POST /api/test-functions avec { "function_name": "update_contest_leaderboard", "contest_id": "uuid" }'
        }
      }
    });

  } catch (error) {
    console.error('Erreur dans GET /api/test-functions:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
