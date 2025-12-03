/*
Source: POST /api/profile/brand/update
Effects: update brand profile + notification preferences
*/
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { assertCsrf } from '@/lib/csrf';
import { createError, formatErrorResponse } from '@/lib/errors';
import { brandProfileUpdateSchema } from '@/lib/validators/profile';
import { getUserRole } from '@/lib/auth';

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

    const role = await getUserRole(user.id);
    if (role !== 'brand') {
      throw createError('FORBIDDEN', 'Accès réservé aux marques', 403);
    }

    const body = await req.json();
    const parsed = brandProfileUpdateSchema.safeParse(body);
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

    const brandPayload: Record<string, unknown> = {
      updated_at: now,
    };
    if (parsed.data.company_name !== undefined) brandPayload.company_name = parsed.data.company_name;
    if (parsed.data.website !== undefined) brandPayload.website = parsed.data.website || null;
    if (parsed.data.industry !== undefined) brandPayload.industry = parsed.data.industry || null;
    if (parsed.data.vat_number !== undefined) brandPayload.vat_number = parsed.data.vat_number || null;
    if (parsed.data.address_line1 !== undefined) brandPayload.address_line1 = parsed.data.address_line1 || null;
    if (parsed.data.address_line2 !== undefined) brandPayload.address_line2 = parsed.data.address_line2 || null;
    if (parsed.data.address_city !== undefined) brandPayload.address_city = parsed.data.address_city || null;
    if (parsed.data.address_postal_code !== undefined)
      brandPayload.address_postal_code = parsed.data.address_postal_code || null;
    if (parsed.data.address_country !== undefined) brandPayload.address_country = parsed.data.address_country || null;

    if (Object.keys(brandPayload).length > 1) {
      const { error: brandError } = await admin
        .from('profile_brands')
        .update(brandPayload)
        .eq('user_id', user.id);
      if (brandError) {
        throw createError('DATABASE_ERROR', 'Mise à jour marque impossible', 500, brandError.message);
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
      new_values: { ...profilePayload, ...brandPayload },
    });

    return NextResponse.json({ ok: true, profile: updatedProfile });
  } catch (error) {
    return formatErrorResponse(error);
  }
}

