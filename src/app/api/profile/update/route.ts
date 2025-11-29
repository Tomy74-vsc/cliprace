/*
Source: POST /api/profile/update
Effects: update creator profile + notification preferences
*/
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { assertCsrf } from '@/lib/csrf';
import { createError, formatErrorResponse } from '@/lib/errors';
import { profileUpdateSchema } from '@/lib/validators/profile';

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

    const body = await req.json();
    const parsed = profileUpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw createError('VALIDATION_ERROR', 'Payload invalide', 400, parsed.error.flatten());
    }

    const admin = getSupabaseAdmin();
    const now = new Date().toISOString();

    const profilePayload: Record<string, unknown> = {
      updated_at: now,
    };
    if (parsed.data.display_name !== undefined) profilePayload.display_name = parsed.data.display_name;
    if (parsed.data.bio !== undefined) profilePayload.bio = parsed.data.bio ?? null;
    if (parsed.data.avatar_url !== undefined) profilePayload.avatar_url = parsed.data.avatar_url ?? null;

    const { data: updatedProfile, error: profileError } = await admin
      .from('profiles')
      .update(profilePayload)
      .eq('id', user.id)
      .select('id, display_name, bio, avatar_url, role')
      .single();
    if (profileError || !updatedProfile) {
      throw createError('DATABASE_ERROR', 'Mise à jour du profil impossible', 500, profileError?.message);
    }

    const creatorPayload: Record<string, unknown> = {
      user_id: user.id,
      updated_at: now,
    };
    if (parsed.data.first_name !== undefined) creatorPayload.first_name = parsed.data.first_name ?? null;
    if (parsed.data.last_name !== undefined) creatorPayload.last_name = parsed.data.last_name ?? null;
    if (parsed.data.handle !== undefined) creatorPayload.handle = parsed.data.handle ?? null;
    if (parsed.data.primary_platform !== undefined) creatorPayload.primary_platform = parsed.data.primary_platform;
    if (parsed.data.followers !== undefined) creatorPayload.followers = parsed.data.followers ?? 0;
    if (parsed.data.avg_views !== undefined) creatorPayload.avg_views = parsed.data.avg_views ?? 0;

    if (Object.keys(creatorPayload).length > 2) {
      const { error: creatorError } = await admin
        .from('profile_creators')
        .upsert(creatorPayload, { onConflict: 'user_id' });
      if (creatorError) {
        throw createError('DATABASE_ERROR', 'Mise à jour créateur impossible', 500, creatorError.message);
      }
    }

    if (parsed.data.notification_preferences) {
      const enabledPrefs = parsed.data.notification_preferences.filter((pref) => pref.enabled);
      const disabledPrefs = parsed.data.notification_preferences.filter((pref) => !pref.enabled);

      if (enabledPrefs.length) {
        const { error: prefsErr } = await admin.from('notification_preferences').upsert(
          enabledPrefs.map((pref) => ({
            user_id: user.id,
            event: pref.event,
            channel: pref.channel,
            enabled: true,
            updated_at: now,
          })),
          { onConflict: 'user_id,event,channel' }
        );
        if (prefsErr) {
          throw createError('DATABASE_ERROR', 'Impossible de mettre à jour les préférences', 500, prefsErr.message);
        }
      }

      if (disabledPrefs.length) {
        await Promise.all(
          disabledPrefs.map((pref) =>
            admin
              .from('notification_preferences')
              .delete()
              .eq('user_id', user.id)
              .eq('event', pref.event)
              .eq('channel', pref.channel)
          )
        );
      }
    }

    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'profile_update',
      table_name: 'profiles',
      row_pk: user.id,
      new_values: profilePayload,
    });

    return NextResponse.json({ ok: true, profile: updatedProfile });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
