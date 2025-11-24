// Source: POST /api/auth/login (Â§6, Â§1168-1169, Â§191)
// Effects: authenticate and return session + profile + role
import { NextRequest, NextResponse } from 'next/server';
import { loginSchema } from '@/lib/validators/auth';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rateLimit';
import { formatErrorResponse, createError } from '@/lib/errors';
import { assertCsrf } from '@/lib/csrf';

export async function POST(req: NextRequest) {
  try {
    // Rate limiting: 10 req/min par IP (Â§4, Â§156)
    const ip = req.headers.get('x-forwarded-for') || req.ip || 'unknown';
    const rlKey = `auth:login:${ip}`;
    if (!(await rateLimit({ key: rlKey, route: 'auth:login', windowMs: 60 * 1000, max: 10 }))) {
      return formatErrorResponse(createError('RATE_LIMIT', 'Trop de tentatives. RÃ©essayez dans 1 minute.', 429));
    }

    // CSRF check (double-submit: cookie must match header)
    try {
      assertCsrf(req.headers.get('x-csrf'));
    } catch (csrfError) {
      return formatErrorResponse(
        createError('FORBIDDEN', 'Token CSRF invalide', 403, csrfError)
      );
    }

    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    
    if (!parsed.success) {
      return formatErrorResponse(
        createError('VALIDATION_ERROR', 'DonnÃ©es invalides', 400, parsed.error.flatten())
      );
    }

    const { email, password } = parsed.data;
    const supabaseSSR = getSupabaseSSR();

    // Authentifier avec email/password
    const { data: authData, error: authError } = await supabaseSSR.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      return formatErrorResponse(
        createError('UNAUTHORIZED', 'Email ou mot de passe incorrect', 401, authError)
      );
    }

    const userId = authData.user.id;

    // RÃ©cupÃ©rer le profil et le rÃ´le
    const admin = getSupabaseAdmin();
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, role, email, display_name, avatar_url, bio, country, is_active')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return formatErrorResponse(
        createError('NOT_FOUND', 'Profil non trouvÃ©', 404, profileError)
      );
    }

    if (!profile.is_active) {
      return formatErrorResponse(
        createError('FORBIDDEN', 'Compte dÃ©sactivÃ©', 403)
      );
    }

    // Audit log
    const ipAddress = req.headers.get('x-forwarded-for') || req.ip || undefined;
    const userAgent = req.headers.get('user-agent') || undefined;
    await admin.from('audit_logs').insert({
      actor_id: userId,
      action: 'user_login',
      table_name: 'profiles',
      row_pk: userId,
      new_values: { email },
      ip: ipAddress,
      user_agent: userAgent,
    });

    // Retourner session + profil + rÃ´le
    return NextResponse.json({
      ok: true,
      user: {
        id: profile.id,
        email: profile.email,
        role: profile.role,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
      },
      session: {
        access_token: authData.session?.access_token,
        refresh_token: authData.session?.refresh_token,
      },
    });
  } catch (error: unknown) {
    return formatErrorResponse(error);
  }
}



