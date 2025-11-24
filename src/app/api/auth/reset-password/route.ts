/*
Source: POST /api/auth/reset-password
Purpose: Demande de réinitialisation de mot de passe
*/
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { rateLimit } from '@/lib/rateLimit';
import { formatErrorResponse, createError } from '@/lib/errors';
import { assertCsrf } from '@/lib/csrf';

const resetPasswordSchema = z.object({
  email: z.string().email('Email invalide'),
});

export async function POST(req: NextRequest) {
  try {
    // Rate limiting: 5 req/15min par IP
    const ip = req.headers.get('x-forwarded-for') || req.ip || 'unknown';
    const rlKey = `auth:reset-password:${ip}`;
    if (!(await rateLimit({ key: rlKey, route: 'auth:reset-password', windowMs: 15 * 60 * 1000, max: 5 }))) {
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
    const parsed = resetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return formatErrorResponse(
        createError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.flatten())
      );
    }

    const { email } = parsed.data;
    const supabase = getSupabaseSSR();

    // Envoyer l'email de réinitialisation
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || 'http://localhost:3000'}/auth/reset-password/confirm`,
    });

    if (resetError) {
      // Ne pas révéler si l'email existe ou non (sécurité)
      // On retourne toujours un succès pour éviter l'énumération d'emails
      return NextResponse.json({
        ok: true,
        message: 'Si cet email existe, un lien de réinitialisation vous a été envoyé.',
      });
    }

    return NextResponse.json({
      ok: true,
      message: 'Si cet email existe, un lien de réinitialisation vous a été envoyé.',
    });
  } catch (error: unknown) {
    return formatErrorResponse(error);
  }
}

