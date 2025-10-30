/**
 * Système de notifications pour la modération
 * 
 * Gère l'envoi de notifications aux créateurs lors des décisions de modération
 */

import { createClient } from '@/lib/supabase/server';

export interface ModerationNotification {
  submission_id: string;
  creator_id: string;
  action: 'approved' | 'rejected' | 'pending_review';
  reason?: string;
  comment?: string;
  moderator_id?: string;
}

export class ModerationNotificationService {
  private supabase: any;

  constructor() {
    this.supabase = createClient();
  }

  /**
   * Envoie une notification de modération à un créateur
   */
  async sendModerationNotification(notification: ModerationNotification): Promise<boolean> {
    try {
      const { action, submission_id, creator_id, reason, comment, moderator_id } = notification;

      // Récupérer les détails de la submission
      const { data: submission, error: submissionError } = await this.supabase
        .from('submissions')
        .select(`
          id,
          video_url,
          network,
          contests!inner(
            id,
            title,
            brand_id
          )
        `)
        .eq('id', submission_id)
        .single();

      if (submissionError || !submission) {
        console.error('Error fetching submission for notification:', submissionError);
        return false;
      }

      // Récupérer les détails du modérateur si disponible
      let moderatorName = 'Système';
      if (moderator_id) {
        const { data: moderator } = await this.supabase
          .from('profiles')
          .select('display_name, email')
          .eq('id', moderator_id)
          .single();
        
        if (moderator) {
          moderatorName = moderator.display_name || moderator.email;
        }
      }

      // Construire le message selon l'action
      let title: string;
      let message: string;
      let type: 'success' | 'error' | 'info' = 'info';

      switch (action) {
        case 'approved':
          title = '🎉 Votre soumission a été approuvée !';
          message = `Votre vidéo pour le concours "${submission.contests.title}" a été approuvée et est maintenant éligible pour les prix.`;
          type = 'success';
          break;

        case 'rejected':
          title = '❌ Votre soumission a été rejetée';
          message = `Votre vidéo pour le concours "${submission.contests.title}" a été rejetée.`;
          if (reason) {
            message += ` Raison : ${reason}`;
          }
          type = 'error';
          break;

        case 'pending_review':
          title = '⏳ Votre soumission nécessite une révision';
          message = `Votre vidéo pour le concours "${submission.contests.title}" nécessite une révision manuelle. Elle sera examinée sous peu.`;
          type = 'info';
          break;

        default:
          title = '📝 Mise à jour de votre soumission';
          message = `Votre soumission pour le concours "${submission.contests.title}" a été mise à jour.`;
      }

      // Ajouter des détails supplémentaires
      if (comment) {
        message += ` Commentaire du modérateur : ${comment}`;
      }

      message += ` Modéré par : ${moderatorName}`;

      // Créer la notification
      const { error: notificationError } = await this.supabase
        .from('notifications')
        .insert({
          user_id: creator_id,
          type: 'moderation',
          title,
          message,
          data: {
            submission_id,
            action,
            reason,
            comment,
            moderator_id,
            contest_title: submission.contests.title,
            video_url: submission.video_url,
            network: submission.network
          },
          read: false
        });

      if (notificationError) {
        console.error('Error creating notification:', notificationError);
        return false;
      }

      // Envoyer un email si configuré
      await this.sendEmailNotification(creator_id, {
        title,
        message,
        submission_id,
        contest_title: submission.contests.title,
        action
      });

      return true;

    } catch (error) {
      console.error('Error sending moderation notification:', error);
      return false;
    }
  }

  /**
   * Envoie une notification par email (optionnel)
   */
  private async sendEmailNotification(creatorId: string, emailData: {
    title: string;
    message: string;
    submission_id: string;
    contest_title: string;
    action: string;
  }): Promise<void> {
    try {
      // Récupérer l'email du créateur
      const { data: creator } = await this.supabase
        .from('profiles')
        .select('email, display_name')
        .eq('id', creatorId)
        .single();

      if (!creator?.email) {
        console.log('No email found for creator:', creatorId);
        return;
      }

      // Vérifier si l'utilisateur a activé les notifications email
      const { data: preferences } = await this.supabase
        .from('notification_preferences')
        .select('email_moderation')
        .eq('user_id', creatorId)
        .single();

      if (preferences?.email_moderation === false) {
        console.log('Email notifications disabled for user:', creatorId);
        return;
      }

      // Construire l'email
      const subject = `ClipRace - ${emailData.title}`;
      const htmlContent = this.buildEmailHTML(emailData);

      // Envoyer l'email via l'API email (si disponible)
      try {
        const response = await fetch('/api/notifications/send-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: creator.email,
            subject,
            html: htmlContent,
            template: 'moderation'
          })
        });

        if (!response.ok) {
          console.error('Failed to send email notification:', await response.text());
        }
      } catch (error) {
        console.error('Email service not available:', error);
      }

    } catch (error) {
      console.error('Error sending email notification:', error);
    }
  }

  /**
   * Construit le HTML de l'email
   */
  private buildEmailHTML(data: {
    title: string;
    message: string;
    submission_id: string;
    contest_title: string;
    action: string;
  }): string {
    const actionEmoji = {
      approved: '🎉',
      rejected: '❌',
      pending_review: '⏳'
    }[data.action] || '📝';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${data.title}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
          .content { padding: 20px; }
          .footer { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; font-size: 14px; color: #666; }
          .button { display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 6px; margin: 10px 0; }
          .button:hover { background: #0056b3; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${actionEmoji} ${data.title}</h1>
          </div>
          <div class="content">
            <p>Bonjour,</p>
            <p>${data.message}</p>
            <p><strong>Concours :</strong> ${data.contest_title}</p>
            <p><strong>ID de soumission :</strong> ${data.submission_id}</p>
            <p>
              <a href="${process.env.NEXT_PUBLIC_SITE_URL}/creator/submissions" class="button">
                Voir mes soumissions
              </a>
            </p>
          </div>
          <div class="footer">
            <p>Cet email a été envoyé automatiquement par ClipRace.</p>
            <p>Vous pouvez modifier vos préférences de notification dans votre profil.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Envoie des notifications en lot
   */
  async sendBulkNotifications(notifications: ModerationNotification[]): Promise<{
    successful: number;
    failed: number;
    errors: string[];
  }> {
    const results = {
      successful: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (const notification of notifications) {
      try {
        const success = await this.sendModerationNotification(notification);
        if (success) {
          results.successful++;
        } else {
          results.failed++;
          results.errors.push(`Failed to send notification for submission ${notification.submission_id}`);
        }
      } catch (error) {
        results.failed++;
        results.errors.push(`Error sending notification for submission ${notification.submission_id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return results;
  }

  /**
   * Marque une notification comme lue
   */
  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId)
        .eq('user_id', userId);

      if (error) {
        console.error('Error marking notification as read:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }
  }

  /**
   * Récupère les notifications de modération pour un utilisateur
   */
  async getModerationNotifications(userId: string, limit: number = 20): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'moderation')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching moderation notifications:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching moderation notifications:', error);
      return [];
    }
  }
}

// Instance singleton
export const moderationNotificationService = new ModerationNotificationService();
