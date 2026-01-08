import { getAdminClient } from '@/lib/admin/supabase';

export type AdminNotificationType =
  | 'cashout_approved'
  | 'cashout_rejected'
  | 'submission_approved'
  | 'submission_rejected'
  | 'contest_published'
  | 'contest_paused'
  | 'contest_ended'
  | 'contest_archived'
  | 'user_activated'
  | 'user_deactivated'
  | 'invoice_generated'
  | 'invoice_voided';

interface AdminNotificationData {
  cashout_approved: { cashout_id: string; amount_cents: number };
  cashout_rejected: { cashout_id: string; reason?: string };
  submission_approved: { submission_id: string; contest_id: string; contest_title?: string };
  submission_rejected: { submission_id: string; contest_id: string; reason?: string; contest_title?: string };
  contest_published: { contest_id: string; contest_title?: string };
  contest_paused: { contest_id: string; contest_title?: string };
  contest_ended: { contest_id: string; contest_title?: string };
  contest_archived: { contest_id: string; contest_title?: string };
  user_activated: { user_id: string };
  user_deactivated: { user_id: string };
  invoice_generated: { invoice_id: string; org_id: string };
  invoice_voided: { invoice_id: string; reason?: string };
}

function _getNotificationTitle(type: AdminNotificationType): string {
  const titles: Record<AdminNotificationType, string> = {
    cashout_approved: 'Cashout approuvé',
    cashout_rejected: 'Cashout rejeté',
    submission_approved: 'Soumission approuvée',
    submission_rejected: 'Soumission rejetée',
    contest_published: 'Concours publié',
    contest_paused: 'Concours mis en pause',
    contest_ended: 'Concours terminé',
    contest_archived: 'Concours archivé',
    user_activated: 'Compte activé',
    user_deactivated: 'Compte désactivé',
    invoice_generated: 'Facture générée',
    invoice_voided: 'Facture annulée',
  };
  return titles[type] || 'Notification';
}

function _getNotificationBody(type: AdminNotificationType, data: Record<string, unknown>): string {
  const bodies: Record<AdminNotificationType, (data: Record<string, unknown>) => string> = {
    cashout_approved: (d) => {
      const amount = typeof d.amount_cents === 'number' ? (d.amount_cents / 100).toFixed(2) : '0';
      return `Votre demande de cashout de ${amount}€ a été approuvée et est en cours de traitement.`;
    },
    cashout_rejected: (d) => {
      const reason = typeof d.reason === 'string' ? ` Raison : ${d.reason}` : '';
      return `Votre demande de cashout a été rejetée.${reason}`;
    },
    submission_approved: (d) => {
      const title = typeof d.contest_title === 'string' ? ` pour "${d.contest_title}"` : '';
      return `Votre soumission${title} a été approuvée.`;
    },
    submission_rejected: (d) => {
      const title = typeof d.contest_title === 'string' ? ` pour "${d.contest_title}"` : '';
      const reason = typeof d.reason === 'string' ? ` Raison : ${d.reason}` : '';
      return `Votre soumission${title} a été rejetée.${reason}`;
    },
    contest_published: (d) => {
      const title = typeof d.contest_title === 'string' ? ` "${d.contest_title}"` : '';
      return `Le concours${title} a été publié et est maintenant actif.`;
    },
    contest_paused: (d) => {
      const title = typeof d.contest_title === 'string' ? ` "${d.contest_title}"` : '';
      return `Le concours${title} a été mis en pause.`;
    },
    contest_ended: (d) => {
      const title = typeof d.contest_title === 'string' ? ` "${d.contest_title}"` : '';
      return `Le concours${title} a été terminé. Les résultats sont maintenant disponibles.`;
    },
    contest_archived: (d) => {
      const title = typeof d.contest_title === 'string' ? ` "${d.contest_title}"` : '';
      return `Le concours${title} a été archivé.`;
    },
    user_activated: () => 'Votre compte a été activé. Vous pouvez maintenant accéder à toutes les fonctionnalités.',
    user_deactivated: () => 'Votre compte a été désactivé. Contactez le support pour plus d\'informations.',
    invoice_generated: () => 'Une nouvelle facture a été générée et est disponible dans votre espace.',
    invoice_voided: (d) => {
      const reason = typeof d.reason === 'string' ? ` Raison : ${d.reason}` : '';
      return `Une facture a été annulée.${reason}`;
    },
  };
  return bodies[type]?.(data) || 'Vous avez reçu une nouvelle notification.';
}

/**
 * Notifie un utilisateur d'une action admin
 */
export async function notifyAdminAction<T extends AdminNotificationType>({
  userId,
  type,
  data,
}: {
  userId: string;
  type: T;
  data: AdminNotificationData[T];
}): Promise<void> {
  const admin = getAdminClient();

  try {
    await admin.from('notifications').insert({
      user_id: userId,
      type,
      content: {
        ...data,
        notification_type: type,
        created_by_admin: true,
      },
      read: false,
    });
  } catch (error) {
    // Log l'erreur mais ne pas faire échouer l'action principale
    console.error(`Failed to create notification for user ${userId}, type ${type}:`, error);
  }
}

/**
 * Notifie plusieurs utilisateurs d'une action admin (bulk)
 */
export async function notifyAdminActionBulk<T extends AdminNotificationType>({
  userIds,
  type,
  data,
}: {
  userIds: string[];
  type: T;
  data: AdminNotificationData[T];
}): Promise<{ notified: number; errors: number }> {
  if (userIds.length === 0) {
    return { notified: 0, errors: 0 };
  }

  const admin = getAdminClient();
  const notifications = userIds.map(userId => ({
    user_id: userId,
    type,
    content: {
      ...data,
      notification_type: type,
      created_by_admin: true,
    },
    read: false,
  }));

  // Insérer par batch (Supabase limite à 1000 par batch)
  const batchSize = 1000;
  let notified = 0;
  let errors = 0;

  for (let i = 0; i < notifications.length; i += batchSize) {
    const batch = notifications.slice(i, i + batchSize);
    const { error } = await admin.from('notifications').insert(batch);

    if (error) {
      console.error(`Error inserting notifications batch ${i / batchSize + 1}:`, error);
      errors += batch.length;
    } else {
      notified += batch.length;
    }
  }

  return { notified, errors };
}

