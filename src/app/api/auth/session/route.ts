import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseSSRWithResponse } from '@/lib/supabase/ssr';
import { assertCsrf } from '@/lib/csrf';
import { formatErrorResponse, createError } from '@/lib/errors';

interface SessionPayload {
  access_token?: string;
  refresh_token?: string;
}

export async function POST(req: NextRequest) {
  try {
    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch (csrfError) {
      return formatErrorResponse(
        createError('FORBIDDEN', 'Token CSRF invalide', 403, csrfError)
      );
    }

    const body = (await req.json()) as SessionPayload | null;

    if (!body?.access_token || !body?.refresh_token) {
      return formatErrorResponse(createError('VALIDATION_ERROR', 'Jetons de session manquants', 400));
    }

    const response = NextResponse.json({ ok: true });
    const supabase = getSupabaseSSRWithResponse(req, response);

    const { error } = await supabase.auth.setSession({
      access_token: body.access_token,
      refresh_token: body.refresh_token,
    });

    if (error) {
      return formatErrorResponse(createError('UNAUTHORIZED', 'Impossible de synchroniser la session', 401, error));
    }

    return response;
  } catch (error: unknown) {
    return formatErrorResponse(error);
  }
}


