import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/rate-limit';
import { getServerSupabase } from '@/lib/supabase/server';
import { ResetPasswordSchema } from '@/lib/validation/auth';
import { logAuditEvent } from '@/lib/audit-logger';

/**
 * API Route pour la réinitialisation effective du mot de passe
 * POST /api/auth/reset-password
 * 
 * Sécurité:
 * - Rate limiting: 5 requêtes/minute
 * - Validation Zod
 * - Nécessite une session de récupération valide (vérifiée par Supabase)
 */
export const POST = withRateLimit('/api/auth/reset-password')(async (request: Request) => {
  const nextRequest = request as NextRequest;

  // Parse et validation du payload
  let payload: unknown;
  try {
    payload = await request.json();
  } catch (error) {
    console.error('Reset password payload parse error:', error);
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const parsed = ResetPasswordSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Paramètres invalides', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { password } = parsed.data;

  try {
    const supabase = await getServerSupabase();

    // Vérifier qu'il y a une session de récupération active
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session de récupération invalide ou expirée. Veuillez demander un nouveau lien.' },
        { status: 401 }
      );
    }

    // Mettre à jour le mot de passe
    const { data, error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      console.error('Erreur lors de la mise à jour du mot de passe:', updateError);
      
      let message = 'Erreur lors de la réinitialisation du mot de passe';
      if (updateError.message.includes('session')) {
        message = 'Session expirée. Veuillez demander un nouveau lien de réinitialisation.';
      }

      return NextResponse.json({ error: message }, { status: 400 });
    }

    if (!data.user) {
      return NextResponse.json(
        { error: 'Utilisateur introuvable' },
        { status: 404 }
      );
    }

    // Logger l'événement de réinitialisation réussie
    await logAuditEvent('UPDATE', 'auth_password_reset_success', {
      entityId: data.user.id,
      data: {
        email: data.user.email,
        timestamp: new Date().toISOString(),
      },
      request: nextRequest,
    });

    return NextResponse.json({
      success: true,
      message: 'Votre mot de passe a été réinitialisé avec succès.',
    });

  } catch (error) {
    console.error('Erreur inattendue lors de la réinitialisation du mot de passe:', error);
    return NextResponse.json(
      { error: 'Erreur lors du traitement de votre demande' },
      { status: 500 }
    );
  }
});

