/*
Source: POST /api/account/delete
Effects: deactivate profile + flag for removal
*/
import { NextRequest, NextResponse } from 'next/server';
import { assertCsrf } from '@/lib/csrf';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { createError, formatErrorResponse } from '@/lib/errors';

export async function POST(req: NextRequest) {
  try {
    try {
      assertCsrf(req.headers.get('x-csrf'));
    } catch {
      throw createError('FORBIDDEN', 'CSRF token invalide', 403);
    }

    const supabaseSSR = getSupabaseSSR();
    const {
      data: { user },
    } = await supabaseSSR.auth.getUser();
    if (!user) {
      throw createError('UNAUTHORIZED', 'Authentification requise', 401);
    }

    const admin = getSupabaseAdmin();
    const now = new Date().toISOString();
    const { error } = await admin
      .from('profiles')
      .update({
        is_active: false,
        display_name: null,
        bio: null,
        updated_at: now,
      })
      .eq('id', user.id);
    if (error) {
      throw createError('DATABASE_ERROR', 'Impossible de désactiver le compte', 500, error.message);
    }

    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'account_delete_request',
      table_name: 'profiles',
      row_pk: user.id,
      new_values: { is_active: false },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
