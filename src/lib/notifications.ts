/*
Helper functions for creating notifications
*/
import { getSupabaseAdmin } from '@/lib/supabase/server';

/**
 * Notifie tous les créateurs éligibles lorsqu'un nouveau concours est activé
 */
export async function notifyEligibleCreatorsAboutNewContest(
  contestId: string,
  contestTitle: string,
  networks: string[],
  admin?: ReturnType<typeof getSupabaseAdmin>
): Promise<{ notified: number; errors: number }> {
  const supabase = admin || getSupabaseAdmin();
  
  try {
    // Récupérer tous les créateurs avec leur statut actif
    const { data: allCreators, error: allCreatorsError } = await supabase
      .from('profile_creators')
      .select(`
        user_id,
        primary_platform,
        profiles!inner (
          id,
          is_active
        )
      `)
      .eq('profiles.is_active', true);

    if (allCreatorsError) {
      console.error('Error fetching creators:', allCreatorsError);
      return { notified: 0, errors: 0 };
    }

    if (!allCreators || allCreators.length === 0) {
      return { notified: 0, errors: 0 };
    }

    // Filtrer les créateurs éligibles :
    // - Plateforme principale correspond aux réseaux du concours
    // - Ou pas de plateforme principale définie (on les notifie aussi)
    // - Ou si le concours accepte toutes les plateformes (networks vide)
    const eligibleCreators = allCreators.filter((creator) => {
      if (networks.length === 0) {
        // Concours ouvert à toutes les plateformes
        return true;
      }
      if (!creator.primary_platform) {
        // Pas de plateforme définie, on notifie quand même
        return true;
      }
      // Vérifier si la plateforme principale est dans les réseaux acceptés
      return networks.includes(creator.primary_platform);
    });

    if (!eligibleCreators || eligibleCreators.length === 0) {
      return { notified: 0, errors: 0 };
    }

    // Créer les notifications
    const notifications = eligibleCreators.map((creator) => ({
      user_id: creator.user_id,
      type: 'contest_created',
      content: {
        contest_id: contestId,
        contest_title: contestTitle,
        networks,
      },
      read: false,
    }));

    // Insérer par batch (Supabase limite à 1000 par batch)
    const batchSize = 1000;
    let notified = 0;
    let errors = 0;

    for (let i = 0; i < notifications.length; i += batchSize) {
      const batch = notifications.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .from('notifications')
        .insert(batch);

      if (insertError) {
        console.error(`Error inserting notifications batch ${i / batchSize + 1}:`, insertError);
        errors += batch.length;
      } else {
        notified += batch.length;
      }
    }

    return { notified, errors };
  } catch (error) {
    console.error('Error in notifyEligibleCreatorsAboutNewContest:', error);
    return { notified: 0, errors: 0 };
  }
}

/**
 * Notifie un créateur lorsqu'une soumission est modérée
 */
export async function notifyCreatorAboutModeration(
  creatorId: string,
  submissionId: string,
  contestId: string,
  status: 'approved' | 'rejected' | 'removed',
  reason: string | null,
  admin?: ReturnType<typeof getSupabaseAdmin>
): Promise<boolean> {
  const supabase = admin || getSupabaseAdmin();

  try {
    const notificationType =
      status === 'approved'
        ? 'submission_approved'
        : status === 'removed'
          ? 'submission_removed'
          : 'submission_rejected';

    const { error } = await supabase.from('notifications').insert({
      user_id: creatorId,
      type: notificationType,
      content: {
        submission_id: submissionId,
        contest_id: contestId,
        status,
        reason: reason || null,
      },
      read: false,
    });

    if (error) {
      console.error('Error creating moderation notification:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in notifyCreatorAboutModeration:', error);
    return false;
  }
}

/**
 * Notifie la marque lorsqu'un concours est activé avec succès
 */
export async function notifyBrandAboutContestActivation(
  brandId: string,
  contestId: string,
  contestTitle: string,
  admin?: ReturnType<typeof getSupabaseAdmin>
): Promise<boolean> {
  const supabase = admin || getSupabaseAdmin();

  try {
    const { error } = await supabase.from('notifications').insert({
      user_id: brandId,
      type: 'contest_activated',
      content: {
        contest_id: contestId,
        contest_title: contestTitle,
      },
      read: false,
    });

    if (error) {
      console.error('Error creating brand notification:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in notifyBrandAboutContestActivation:', error);
    return false;
  }
}

