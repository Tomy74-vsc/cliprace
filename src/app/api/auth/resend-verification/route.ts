// Source: POST /api/auth/resend-verification - Resend verification email
// Effects: Generate and send verification email to user
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rateLimit';
import { formatErrorResponse, createError } from '@/lib/errors';
import { assertCsrf } from '@/lib/csrf';
import { z } from 'zod';
import { env } from '@/lib/env';
import { createClient } from '@supabase/supabase-js';

const resendVerificationSchema = z.object({
  email: z.string().email(),
});

export async function POST(req: NextRequest) {
  try {
    // Rate limiting: 3 req/min par IP
    const ip = req.headers.get('x-forwarded-for') || req.ip || 'unknown';
    const rlKey = `auth:resend-verification:${ip}`;
    if (
      !(await rateLimit({ key: rlKey, route: 'auth:resend-verification', windowMs: 60 * 1000, max: 3 }))
    ) {
      return formatErrorResponse(
        createError('RATE_LIMIT', 'Trop de tentatives. Réessayez dans 1 minute.', 429)
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
    const parsed = resendVerificationSchema.safeParse(body);

    if (!parsed.success) {
      return formatErrorResponse(
        createError('VALIDATION_ERROR', 'Email invalide', 400, parsed.error.flatten())
      );
    }

    const { email } = parsed.data;
    const admin = getSupabaseAdmin();

    // Vérifier si l'utilisateur existe
    const { data: users } = await admin.auth.admin.listUsers();
    const user = users.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

    if (!user) {
      return formatErrorResponse(createError('NOT_FOUND', "Utilisateur non trouvé", 404));
    }

    // Vérifier si l'email est déjà confirmé
    if (user.email_confirmed_at) {
      return formatErrorResponse(
        createError('BAD_REQUEST', 'Email déjà vérifié', 400)
      );
    }

    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase URL ou clé ANON manquante.');
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const siteUrl = env.NEXT_PUBLIC_SITE_URL || env.APP_URL || 'http://localhost:3000';

    const { error: resendError } = await authClient.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${siteUrl}/auth/verify?email=${encodeURIComponent(email)}`,
      },
    });

    if (resendError) {
      return formatErrorResponse(
        createError(
          'DATABASE_ERROR',
          "Impossible d'envoyer l'email de vérification",
          500,
          resendError
        )
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Un nouvel email de vérification vient d'être envoyé.",
    });
  } catch (error: unknown) {
    return formatErrorResponse(error);
  }
}

