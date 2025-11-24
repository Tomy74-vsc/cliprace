/*
Source: GET /api/contests/[id]/eligibility
Purpose: Vérifier l'éligibilité d'un créateur à participer à un concours
Tables: contests, submissions, profiles, profile_creators
DB functions: is_contest_active(uuid), can_creator_submit(uuid, uuid)
*/
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth';
import { formatErrorResponse } from '@/lib/errors';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user } = await getSession();

    if (!user) {
      return NextResponse.json({ eligible: false, reason: 'Non authentifié' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();

    // Check if contest is active
    const { data: isActive, error: activeError } = await admin.rpc('is_contest_active', {
      p_contest_id: id,
    });

    if (activeError) {
      return NextResponse.json(
        { eligible: false, reason: 'Erreur lors de la vérification' },
        { status: 500 }
      );
    }

    if (!isActive) {
      return NextResponse.json({
        eligible: false,
        reason: 'Ce concours n\'est pas actif pour le moment',
      });
    }

    // Check if creator can submit
    const { data: canSubmit, error: canError } = await admin.rpc('can_creator_submit', {
      p_contest_id: id,
      p_creator_id: user.id,
    });

    if (canError) {
      return NextResponse.json(
        { eligible: false, reason: 'Erreur lors de la vérification' },
        { status: 500 }
      );
    }

    if (!canSubmit) {
      // Get more details about why
      const { data: submission } = await admin
        .from('submissions')
        .select('status')
        .eq('contest_id', id)
        .eq('creator_id', user.id)
        .maybeSingle();

      if (submission) {
        if (submission.status === 'rejected') {
          return NextResponse.json({
            eligible: false,
            reason: 'Votre soumission a été refusée',
          });
        }
        return NextResponse.json({
          eligible: false,
          reason: 'Vous avez déjà participé à ce concours',
        });
      }

      return NextResponse.json({
        eligible: false,
        reason: 'Vous n\'êtes pas éligible pour ce concours',
      });
    }

    return NextResponse.json({ eligible: true });
  } catch (error) {
    return formatErrorResponse(error);
  }
}

