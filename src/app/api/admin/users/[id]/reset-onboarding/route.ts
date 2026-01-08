import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { assertCsrf } from '@/lib/csrf';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { enforceNotReadOnly } from '@/lib/admin/middleware-readonly';
import { userValidators } from '@/lib/admin/validators';
import { createError, formatErrorResponse } from '@/lib/errors';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user: actor } = await requireAdminPermission('users.write');
    await enforceNotReadOnly(req, actor.id);
    await enforceAdminRateLimit(req, { route: 'admin:users:reset-onboarding', max: 20, windowMs: 60_000 }, actor.id);
    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch (csrfError) {
      throw createError('FORBIDDEN', 'Jeton CSRF invalide', 403, csrfError);
    }

    const { id } = await context.params;
    
    // Validation métier
    const validation = await userValidators.canResetOnboarding(id);
    if (!validation.valid) {
      throw createError(
        'VALIDATION_ERROR',
        'Cannot reset onboarding',
        400,
        { errors: validation.errors }
      );
    }

    const admin = getAdminClient();
    const { data: current, error: currentError } = await admin
      .from('profiles')
      .select('id, onboarding_complete')
      .eq('id', id)
      .single();
    if (currentError || !current) {
      throw createError('NOT_FOUND', 'Utilisateur introuvable', 404, currentError?.message);
    }

    const now = new Date().toISOString();
    const { error: updateError } = await admin
      .from('profiles')
      .update({ onboarding_complete: false, updated_at: now })
      .eq('id', id);
    if (updateError) {
      throw createError('DATABASE_ERROR', "Impossible de réinitialiser l'onboarding", 500, updateError.message);
    }

    await admin.from('audit_logs').insert({
      actor_id: actor.id,
      action: 'admin_user_reset_onboarding',
      table_name: 'profiles',
      row_pk: id,
      old_values: { onboarding_complete: current.onboarding_complete },
      new_values: { onboarding_complete: false },
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
