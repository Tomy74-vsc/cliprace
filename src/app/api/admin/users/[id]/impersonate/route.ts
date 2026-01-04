import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { assertCsrf } from '@/lib/csrf';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { createError, formatErrorResponse } from '@/lib/errors';

const BodySchema = z.object({
  next: z.string().max(200).optional(),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user: actor } = await requireAdminPermission('users.write');
    await enforceAdminRateLimit(req, { route: 'admin:users:impersonate', max: 10, windowMs: 60_000 });
    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch (csrfError) {
      throw createError('FORBIDDEN', 'Jeton CSRF invalide', 403, csrfError);
    }

    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      throw createError('VALIDATION_ERROR', 'Payload invalide', 400, parsed.error.flatten());
    }

    const admin = getAdminClient();
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, email')
      .eq('id', id)
      .single();
    if (profileError || !profile) {
      throw createError('NOT_FOUND', 'Utilisateur introuvable', 404, profileError?.message);
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!serviceKey || !supabaseUrl) {
      throw createError('UNKNOWN', 'Configuration Supabase manquante', 500);
    }

    const nextPath = parsed.data.next?.startsWith('/') ? parsed.data.next : undefined;
    const redirectTo = `${req.nextUrl.origin}/auth/callback${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ''}`;

    const generateRes = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        type: 'magiclink',
        email: profile.email,
        options: { redirectTo },
      }),
    });

    const generateData = await generateRes.json().catch(() => null);
    if (!generateRes.ok) {
      throw createError('UNKNOWN', 'Impossible de générer le lien', 500, generateData);
    }

    const actionLink = generateData?.action_link ?? generateData?.properties?.action_link ?? null;
    if (!actionLink) {
      throw createError('UNKNOWN', 'Réponse Supabase inattendue (action_link manquant)', 500, generateData);
    }

    await admin.from('audit_logs').insert({
      actor_id: actor.id,
      action: 'admin_user_impersonation_link',
      table_name: 'profiles',
      row_pk: id,
      new_values: { redirect_to: redirectTo },
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({
      ok: true,
      user_id: id,
      email: profile.email,
      redirect_to: redirectTo,
      action_link: actionLink,
    });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
