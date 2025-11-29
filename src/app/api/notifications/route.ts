import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { createError, formatErrorResponse } from '@/lib/errors';

const QuerySchema = z.object({
  limit: z.coerce.number().min(1).max(20).default(5),
});

export async function GET(req: NextRequest) {
  try {
    const supabaseSSR = await getSupabaseSSR();
    const {
      data: { user },
    } = await supabaseSSR.auth.getUser();
    if (!user) {
      throw createError('UNAUTHORIZED', 'Authentification requise', 401);
    }

    const parsed = QuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
    const limit = parsed.success ? parsed.data.limit : 5;

    // Try RLS path first
    let { data, error } = await supabaseSSR
      .from('notifications')
      .select('id, type, content, created_at, read')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Fallback to service role if blocked
    if (error || !data) {
      const admin = getSupabaseAdmin();
      const res = await admin
        .from('notifications')
        .select('id, type, content, created_at, read')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);
      data = res.data || [];
      error = res.error;
    }

    if (error) {
      throw createError('DATABASE_ERROR', 'Impossible de récupérer les notifications', 500, error.message);
    }

    return NextResponse.json({ notifications: data ?? [] });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
