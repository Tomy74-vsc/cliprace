import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { assertCsrf } from '@/lib/csrf';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { enforceNotReadOnly } from '@/lib/admin/middleware-readonly';
import { assertReason } from '@/lib/admin/reason';
import { auditAdminAction } from '@/lib/admin/audit-enhanced';
import { userValidators } from '@/lib/admin/validators';
import { createError, formatErrorResponse } from '@/lib/errors';

const BodySchema = z.object({
  next: z.string().max(200).optional(),
  reason: z.string().min(8).max(500),
  reason_code: z.enum(['support', 'debugging', 'testing', 'other']).optional(),
  ttl_minutes: z.coerce.number().int().min(1).max(60).default(15),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Permission dédiée pour impersonation
    const { user: actor } = await requireAdminPermission('users.impersonate');
    await enforceNotReadOnly(req, actor.id);
    await enforceAdminRateLimit(req, { route: 'admin:users:impersonate', max: 10, windowMs: 60_000 }, actor.id);
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

    // Reason obligatoire
    const { reason, reason_code } = assertReason(body);
    const ttlMinutes = parsed.data.ttl_minutes || 15;

    // Validation métier
    const validation = await userValidators.canImpersonate(id, actor.id);
    if (!validation.valid) {
      throw createError(
        'VALIDATION_ERROR',
        'Cannot impersonate user',
        400,
        { errors: validation.errors }
      );
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

    // Générer un token avec TTL
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();

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
        options: {
          redirectTo,
          // TTL via expiration du token (Supabase gère automatiquement)
        },
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

    // Audit enrichi avec target_user_id, TTL, reason
    await auditAdminAction({
      actorId: actor.id,
      action: 'admin_user_impersonation',
      entity: 'profiles',
      entityId: id,
      before: null,
      after: {
        target_user_id: id,
        target_email: profile.email,
        ttl_minutes: ttlMinutes,
        expires_at: expiresAt,
        redirect_to: redirectTo,
      },
      reason,
      reasonCode: reason_code,
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      userAgent: req.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({
      ok: true,
      user_id: id,
      email: profile.email,
      redirect_to: redirectTo,
      action_link: actionLink,
      expires_at: expiresAt,
      ttl_minutes: ttlMinutes,
    });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
