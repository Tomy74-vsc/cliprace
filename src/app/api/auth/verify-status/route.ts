import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { formatErrorResponse, createError } from '@/lib/errors';

// Source: GET /api/auth/verify-status?email=...
// Purpose: Permet à /auth/verify de savoir si l'email est confirmé côté Supabase.
export async function GET(req: NextRequest) {
  try {
    const email = req.nextUrl.searchParams.get('email');

    if (!email) {
      return formatErrorResponse(
        createError('VALIDATION_ERROR', 'Email manquant', 400)
      );
    }

    const admin = getSupabaseAdmin();
    const { data: users, error } = await admin.auth.admin.listUsers();

    if (error) {
      return formatErrorResponse(
        createError('DATABASE_ERROR', 'Erreur lors de la vérification du statut email', 500, error)
      );
    }

    const user = users.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (!user) {
      // On ne révèle pas plus d'infos qu'il n'en faut.
      return NextResponse.json({
        ok: true,
        exists: false,
        verified: false,
      });
    }

    const verified = !!user.email_confirmed_at;

    return NextResponse.json({
      ok: true,
      exists: true,
      verified,
    });
  } catch (error: unknown) {
    return formatErrorResponse(error);
  }
}

