import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { assertCsrf } from '@/lib/csrf';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { enforceNotReadOnly } from '@/lib/admin/middleware-readonly';
import { createError, formatErrorResponse } from '@/lib/errors';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const bootstrapSecret = process.env.ADMIN_BOOTSTRAP_SECRET;
    const headerSecret = req.headers.get('x-admin-bootstrap-secret');
    const usingSecret =
      !!bootstrapSecret && !!headerSecret && headerSecret === bootstrapSecret;

    let user: { id: string } | null = null;
    if (!usingSecret) {
      const result = await requireAdminPermission('users.write');
      user = result.user;
      await enforceNotReadOnly(req, user.id);
      await enforceAdminRateLimit(req, { route: 'admin:users:sync-auth', max: 10, windowMs: 60_000 }, user.id);
      try {
        assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
      } catch (csrfError) {
        throw createError('FORBIDDEN', 'Invalid CSRF token', 403, csrfError);
      }
    }

    const admin = getAdminClient();
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, role, email')
      .eq('id', id)
      .single();

    if (profileError || !profile) {
      throw createError('NOT_FOUND', 'Profile not found', 404, profileError?.message);
    }

    const { data: authData, error: authError } = await admin.auth.admin.getUserById(id);
    if (authError || !authData.user) {
      throw createError('NOT_FOUND', 'Auth user not found', 404, authError?.message);
    }

    const updatedMetadata = { ...(authData.user.user_metadata ?? {}), role: profile.role };
    const { error: updateError } = await admin.auth.admin.updateUserById(id, {
      user_metadata: updatedMetadata,
    });

    if (updateError) {
      throw createError('DATABASE_ERROR', 'Failed to update auth metadata', 500, updateError.message);
    }

    return NextResponse.json({
      ok: true,
      user_id: profile.id,
      email: profile.email,
      role: profile.role,
    });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
