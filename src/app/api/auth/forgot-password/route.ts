import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/rate-limit';
import { getServerSupabase } from '@/lib/supabase/server';
import { ForgotPasswordSchema } from '@/lib/validation/auth';
import { logAuditEvent } from '@/lib/audit-logger';

/**
 * API Route pour la demande de réinitialisation de mot de passe
 * POST /api/auth/forgot-password
 * 
 * Sécurité:
 * - Rate limiting: 3 requêtes/minute
 * - Validation Zod
 * - Messages non verbeux (ne révèle pas si l'email existe)
 */
export const POST = withRateLimit('/api/auth/forgot-password')(async (request: Request) => {
  const nextRequest = request as NextRequest;

  // Parse et validation du payload
  let payload: unknown;
  try {
    payload = await request.json();
  } catch (error) {
    console.error('Forgot password payload parse error:', error);
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const parsed = ForgotPasswordSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Paramètres invalides', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { email } = parsed.data;

  try {
    const supabase = await getServerSupabase();
    
    // Obtenir l'origin pour la redirection
    const originHeader = nextRequest.headers.get('origin');
    const origin = originHeader ?? new URL(nextRequest.url).origin;

    // Envoyer l'email de réinitialisation
    // Note: Supabase ne révèle pas si l'email existe (comportement sécurisé)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/reset-password`,
    });

    // Logger l'événement (succès ou échec)
    await logAuditEvent('UPDATE', 'auth_password_reset_request', {
      entityId: email, // On log l'email (pas l'ID user car on ne sait pas s'il existe)
      data: {
        email,
        timestamp: new Date().toISOString(),
        success: !error,
      },
      request: nextRequest,
    });

    // Toujours retourner succès pour ne pas révéler si l'email existe
    // Même comportement que Supabase par défaut
    if (error) {
      // Logger l'erreur côté serveur mais ne pas la révéler au client
      console.error('Erreur lors de l\'envoi de l\'email de réinitialisation:', error);
    }

    // Message générique qui ne révèle pas si l'email existe
    return NextResponse.json({
      success: true,
      message: 'Si un compte existe avec cet email, un lien de réinitialisation vous a été envoyé.',
    });

  } catch (error) {
    console.error('Erreur inattendue lors de la demande de réinitialisation:', error);
    return NextResponse.json(
      { error: 'Erreur lors du traitement de votre demande' },
      { status: 500 }
    );
  }
});

