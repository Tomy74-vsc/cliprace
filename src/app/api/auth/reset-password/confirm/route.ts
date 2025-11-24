/*
Source: POST /api/auth/reset-password/confirm
Purpose: Confirme la réinitialisation de mot de passe avec nouveau password
*/
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseSSRWithResponse } from '@/lib/supabase/ssr';
import { rateLimit } from '@/lib/rateLimit';
import { formatErrorResponse, createError } from '@/lib/errors';
import { assertCsrf } from '@/lib/csrf';

const confirmResetPasswordSchema = z.object({
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
  access_token: z.string().min(1, 'Token d\'accès manquant'),
  refresh_token: z.string().min(1, 'Token de rafraîchissement manquant'),
});

export async function POST(req: NextRequest) {
  try {
    // Rate limiting: 5 req/15min par IP
    const ip = req.headers.get('x-forwarded-for') || req.ip || 'unknown';
    const rlKey = `auth:reset-password-confirm:${ip}`;
    if (!(await rateLimit({ key: rlKey, route: 'auth:reset-password:confirm', windowMs: 15 * 60 * 1000, max: 5 }))) {
      return formatErrorResponse(
        createError('RATE_LIMIT', 'Trop de tentatives. Réessayez dans 15 minutes.', 429)
      );
    }

    // CSRF check
    try {
      assertCsrf(req.headers.get('x-csrf'));
    } catch (csrfError) {
      return formatErrorResponse(
        createError('FORBIDDEN', 'Token CSRF invalide', 403, csrfError)
      );
    }

    const body = await req.json();
    const parsed = confirmResetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return formatErrorResponse(
        createError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.flatten())
      );
    }

    const { password, access_token, refresh_token } = parsed.data;
    // Prepare a JSON response that will carry cookies set by Supabase SSR helper
    const response = NextResponse.json({ ok: true, message: 'Votre mot de passe a été mis à jour avec succès.' });
    const supabase = getSupabaseSSRWithResponse(req, response);

    const { error: sessionError } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });

    if (sessionError) {
      return formatErrorResponse(
        createError('UNAUTHORIZED', 'Token invalide ou expiré. Veuillez redemander un lien de réinitialisation.', 401, sessionError)
      );
    }

    // Vérifier que l'utilisateur est authentifié après la restauration de session
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return formatErrorResponse(
        createError('UNAUTHORIZED', 'Token invalide ou expiré. Veuillez redemander un lien de réinitialisation.', 401, userError)
      );
    }

    // Mettre à jour le mot de passe
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      return formatErrorResponse(
        createError('DATABASE_ERROR', 'Erreur lors de la mise à jour du mot de passe', 500, updateError)
      );
    }

    return response;
  } catch (error: unknown) {
    return formatErrorResponse(error);
  }
}

