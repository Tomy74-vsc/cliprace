import sgMail from '@sendgrid/mail';

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface EmailData {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
}

/**
 * Send email using SendGrid
 */
export async function sendEmail(data: EmailData): Promise<{ success: boolean; error?: string }> {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      console.warn('SendGrid API key not configured, skipping email');
      return { success: true };
    }

    const msg = {
      to: data.to,
      from: data.from || process.env.SENDGRID_FROM_EMAIL || 'noreply@cliprace.com',
      subject: data.subject,
      text: data.text,
      html: data.html,
    };

    await sgMail.send(msg);
    return { success: true };
  } catch (error) {
    console.error('SendGrid error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Get email template for notification type
 */
export function getEmailTemplate(
  type: string, 
  payload: Record<string, any>,
  userData?: { name?: string; email?: string }
): EmailTemplate {
  const userName = userData?.name || 'User';
  
  switch (type) {
    case 'submission_received':
      return {
        subject: 'Nouvelle soumission reçue - ClipRace',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Nouvelle soumission reçue</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">🎬 Nouvelle soumission reçue</h1>
            </div>
            
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px; margin-bottom: 20px;">Bonjour ${userName},</p>
              
              <p style="font-size: 16px; margin-bottom: 20px;">
                Vous avez reçu une nouvelle soumission pour votre concours sur ClipRace.
              </p>
              
              <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; margin: 20px 0;">
                <h3 style="margin: 0 0 10px 0; color: #333;">Détails de la soumission</h3>
                <p style="margin: 5px 0;"><strong>ID de la soumission:</strong> ${payload.submission_id || 'N/A'}</p>
                <p style="margin: 5px 0;"><strong>ID du concours:</strong> ${payload.contest_id || 'N/A'}</p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL}/brand/contests/${payload.contest_id}" 
                   style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                  Voir le concours
                </a>
              </div>
              
              <p style="font-size: 14px; color: #666; margin-top: 30px;">
                Cordialement,<br>
                L'équipe ClipRace
              </p>
            </div>
          </body>
          </html>
        `,
        text: `
          Nouvelle soumission reçue - ClipRace
          
          Bonjour ${userName},
          
          Vous avez reçu une nouvelle soumission pour votre concours sur ClipRace.
          
          Détails de la soumission:
          - ID de la soumission: ${payload.submission_id || 'N/A'}
          - ID du concours: ${payload.contest_id || 'N/A'}
          
          Consultez votre tableau de bord pour plus de détails.
          
          Cordialement,
          L'équipe ClipRace
        `
      };
    
    case 'submission_status':
      const isApproved = payload.status === 'approved';
      return {
        subject: `Soumission ${isApproved ? 'approuvée' : 'rejetée'} - ClipRace`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Soumission ${isApproved ? 'approuvée' : 'rejetée'}</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, ${isApproved ? '#10b981' : '#ef4444'} 0%, ${isApproved ? '#059669' : '#dc2626'} 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">
                ${isApproved ? '✅ Soumission approuvée' : '❌ Soumission rejetée'}
              </h1>
            </div>
            
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px; margin-bottom: 20px;">Bonjour ${userName},</p>
              
              <p style="font-size: 16px; margin-bottom: 20px;">
                Votre soumission a été ${isApproved ? 'approuvée' : 'rejetée'}.
                ${!isApproved && payload.reason ? ` Raison: ${payload.reason}` : ''}
              </p>
              
              <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid ${isApproved ? '#10b981' : '#ef4444'}; margin: 20px 0;">
                <h3 style="margin: 0 0 10px 0; color: #333;">Détails de la soumission</h3>
                <p style="margin: 5px 0;"><strong>Statut:</strong> ${payload.status}</p>
                <p style="margin: 5px 0;"><strong>ID de la soumission:</strong> ${payload.submission_id || 'N/A'}</p>
                ${payload.reason ? `<p style="margin: 5px 0;"><strong>Raison:</strong> ${payload.reason}</p>` : ''}
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL}/creator/submissions" 
                   style="background: ${isApproved ? '#10b981' : '#ef4444'}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                  Voir mes soumissions
                </a>
              </div>
              
              <p style="font-size: 14px; color: #666; margin-top: 30px;">
                Cordialement,<br>
                L'équipe ClipRace
              </p>
            </div>
          </body>
          </html>
        `,
        text: `
          Soumission ${isApproved ? 'approuvée' : 'rejetée'} - ClipRace
          
          Bonjour ${userName},
          
          Votre soumission a été ${isApproved ? 'approuvée' : 'rejetée'}.
          ${!isApproved && payload.reason ? ` Raison: ${payload.reason}` : ''}
          
          Détails de la soumission:
          - Statut: ${payload.status}
          - ID de la soumission: ${payload.submission_id || 'N/A'}
          ${payload.reason ? `- Raison: ${payload.reason}` : ''}
          
          Consultez votre tableau de bord pour plus de détails.
          
          Cordialement,
          L'équipe ClipRace
        `
      };
    
    case 'payment_received':
      const amount = (payload.amount_cents || 0) / 100;
      return {
        subject: 'Paiement reçu - ClipRace',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Paiement reçu</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">💰 Paiement reçu</h1>
            </div>
            
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px; margin-bottom: 20px;">Bonjour ${userName},</p>
              
              <p style="font-size: 16px; margin-bottom: 20px;">
                Félicitations ! Vous avez reçu un paiement de <strong>${amount}€</strong>.
              </p>
              
              <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0;">
                <h3 style="margin: 0 0 10px 0; color: #333;">Détails du paiement</h3>
                <p style="margin: 5px 0;"><strong>Montant:</strong> ${amount}€</p>
                <p style="margin: 5px 0;"><strong>Date:</strong> ${new Date().toLocaleDateString('fr-FR')}</p>
                ${payload.cashout_id ? `<p style="margin: 5px 0;"><strong>ID du retrait:</strong> ${payload.cashout_id}</p>` : ''}
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL}/creator/wallet" 
                   style="background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                  Voir mon portefeuille
                </a>
              </div>
              
              <p style="font-size: 14px; color: #666; margin-top: 30px;">
                Cordialement,<br>
                L'équipe ClipRace
              </p>
            </div>
          </body>
          </html>
        `,
        text: `
          Paiement reçu - ClipRace
          
          Bonjour ${userName},
          
          Félicitations ! Vous avez reçu un paiement de ${amount}€.
          
          Détails du paiement:
          - Montant: ${amount}€
          - Date: ${new Date().toLocaleDateString('fr-FR')}
          ${payload.cashout_id ? `- ID du retrait: ${payload.cashout_id}` : ''}
          
          Consultez votre portefeuille pour plus de détails.
          
          Cordialement,
          L'équipe ClipRace
        `
      };
    
    default:
      return {
        subject: 'Notification ClipRace',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Notification ClipRace</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">🔔 Notification ClipRace</h1>
            </div>
            
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px; margin-bottom: 20px;">Bonjour ${userName},</p>
              
              <p style="font-size: 16px; margin-bottom: 20px;">
                Vous avez une nouvelle notification sur ClipRace.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL}" 
                   style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                  Voir la notification
                </a>
              </div>
              
              <p style="font-size: 14px; color: #666; margin-top: 30px;">
                Cordialement,<br>
                L'équipe ClipRace
              </p>
            </div>
          </body>
          </html>
        `,
        text: `
          Notification ClipRace
          
          Bonjour ${userName},
          
          Vous avez une nouvelle notification sur ClipRace.
          
          Consultez votre tableau de bord pour plus de détails.
          
          Cordialement,
          L'équipe ClipRace
        `
      };
  }
}

/**
 * Send notification email
 */
export async function sendNotificationEmail(
  to: string,
  type: string,
  payload: Record<string, any>,
  userData?: { name?: string; email?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const template = getEmailTemplate(type, payload, userData);
    
    return await sendEmail({
      to,
      subject: template.subject,
      html: template.html,
      text: template.text
    });
  } catch (error) {
    console.error('Error sending notification email:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}
