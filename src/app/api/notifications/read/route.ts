/*
Source: POST /api/notifications/read
Effects: mark notifications as read for current user (optionally specific IDs)
*/
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { assertCsrf } from '@/lib/csrf';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { createError, formatErrorResponse } from '@/lib/errors';

const BodySchema = z.object({
  ids: z.array(z.string().uuid()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch {
      throw createError('FORBIDDEN', 'CSRF token invalide', 403);
    }

    const supabaseSSR = await getSupabaseSSR();
    const {
      data: { user },
    } = await supabaseSSR.auth.getUser();
    if (!user) {
      throw createError('UNAUTHORIZED', 'Authentification requise', 401);
    }

    const body = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      throw createError('VALIDATION_ERROR', 'Payload invalide', 400, parsed.error.flatten());
    }

    const admin = getSupabaseAdmin();
    const query = admin.from('notifications').update({ read: true }).eq('user_id', user.id);
    if (parsed.data.ids?.length) {
      query.in('id', parsed.data.ids);
    } else {
      query.eq('read', false);
    }

    const { error } = await query;
    if (error) {
      throw createError('DATABASE_ERROR', 'Impossible de marquer les notifications', 500, error.message);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
