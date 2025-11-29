// Source: POST /api/profile/complete (§6, §1172-1173, §192)
// Effects: finalize onboarding (service role writes if needed, e.g. KYC states for brand)
import { NextRequest, NextResponse } from 'next/server';
import { profileCompleteSchema } from '@/lib/validators/auth';
import { getSession, getUserRole } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { formatErrorResponse, createError } from '@/lib/errors';
import { assertCsrf } from '@/lib/csrf';
import { computeOnboardingComplete } from '@/lib/onboarding';
import type { ProfileUpdate, ProfileCreatorUpdate, ProfileBrandUpdate } from '@/types/db';

const CREATOR_PLATFORMS = ['tiktok', 'instagram', 'youtube'] as const;
type CreatorPlatform = (typeof CREATOR_PLATFORMS)[number];

export async function POST(req: NextRequest) {
  try {
    // CSRF check (double-submit: cookie must match header)
    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch (csrfError) {
      return formatErrorResponse(
        createError('FORBIDDEN', 'Token CSRF invalide', 403, csrfError)
      );
    }

    const { user, error } = await getSession();
    
    if (error || !user) {
      return formatErrorResponse(createError('UNAUTHORIZED', 'Non authentifié', 401));
    }

    const role = await getUserRole(user.id);
    
    if (!role) {
      return formatErrorResponse(createError('NOT_FOUND', 'Profil non trouvé', 404));
    }

    const body = await req.json();
    const parsed = profileCompleteSchema.safeParse(body);
    
    if (!parsed.success) {
      return formatErrorResponse(
        createError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.flatten())
      );
    }

    const admin = getSupabaseAdmin();
    const updates: ProfileUpdate = {};

    // Mise à jour du profil principal si nécessaire
    if (parsed.data.bio !== undefined) {
      updates.bio = parsed.data.bio;
    }

    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString();
      const { error: profileError } = await admin
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (profileError) {
        return formatErrorResponse(
          createError('DATABASE_ERROR', 'Erreur lors de la mise à jour du profil', 500, profileError)
        );
      }
    }

    // Mise à jour des détails spécifiques selon le rôle
    if (role === 'creator') {
      const creatorUpdates: ProfileCreatorUpdate = {};
      
      if (parsed.data.username !== undefined) {
        creatorUpdates.handle = parsed.data.username;
      }
      if (parsed.data.primary_platform !== undefined) {
        creatorUpdates.primary_platform = parsed.data.primary_platform;
      }
      if (parsed.data.followers !== undefined) {
        creatorUpdates.followers = parsed.data.followers;
      }
      if (parsed.data.avg_views !== undefined) {
        creatorUpdates.avg_views = parsed.data.avg_views;
      }

      if (Object.keys(creatorUpdates).length > 0) {
        creatorUpdates.updated_at = new Date().toISOString();
        const { error: creatorError } = await admin
          .from('profile_creators')
          .update(creatorUpdates)
          .eq('user_id', user.id);

        if (creatorError) {
          return formatErrorResponse(
            createError('DATABASE_ERROR', 'Erreur lors de la mise à jour du profil créateur', 500, creatorError)
          );
        }
      }

      if (parsed.data.platform_links) {
        const normalizedLinks = Object.entries(parsed.data.platform_links).reduce<Map<CreatorPlatform, string>>((acc, [key, value]) => {
          const platformKey = key.toLowerCase() as CreatorPlatform;
          if (!CREATOR_PLATFORMS.includes(platformKey)) {
            return acc;
          }
          const cleanedValue = typeof value === 'string' ? value.trim() : '';
          acc.set(platformKey, cleanedValue);
          return acc;
        }, new Map());

        if (normalizedLinks.size > 0) {
          const { data: existingAccounts, error: existingAccountsError } = await admin
            .from('platform_accounts')
            .select('id, platform, handle')
            .eq('user_id', user.id);

          if (existingAccountsError) {
            return formatErrorResponse(
              createError('DATABASE_ERROR', 'Erreur lors de la récupération des comptes plateformes', 500, existingAccountsError)
            );
          }

          const existingMap = new Map<string, { id: string; handle: string | null }>();
          existingAccounts?.forEach((account) => {
            existingMap.set(account.platform, { id: account.id, handle: account.handle });
          });

          for (const [platform, handle] of normalizedLinks.entries()) {
            const existing = existingMap.get(platform);
            const hasHandle = !!handle;

            if (hasHandle && !existing) {
              const { error: insertError } = await admin.from('platform_accounts').insert({
                user_id: user.id,
                platform,
                handle,
              });
              if (insertError) {
                return formatErrorResponse(
                  createError('DATABASE_ERROR', "Erreur lors de l'enregistrement du compte plateforme", 500, insertError)
                );
              }
            } else if (hasHandle && existing && existing.handle !== handle) {
              const { error: updateError } = await admin
                .from('platform_accounts')
                .update({ handle })
                .eq('id', existing.id);
              if (updateError) {
                return formatErrorResponse(
                  createError('DATABASE_ERROR', 'Erreur lors de la mise à jour du compte plateforme', 500, updateError)
                );
              }
            } else if (!hasHandle && existing) {
              const { error: deleteError } = await admin
                .from('platform_accounts')
                .delete()
                .eq('id', existing.id);
              if (deleteError) {
                return formatErrorResponse(
                  createError('DATABASE_ERROR', 'Erreur lors de la suppression du compte plateforme', 500, deleteError)
                );
              }
            }
          }
        }
      }
    } else if (role === 'brand') {
      const brandUpdates: ProfileBrandUpdate = {};
      
      if (parsed.data.company_name !== undefined) {
        brandUpdates.company_name = parsed.data.company_name;
      }
      if (parsed.data.vat_number !== undefined) {
        brandUpdates.vat_number = parsed.data.vat_number;
      }
      // Support address complète
      if (parsed.data.address_line1 !== undefined) {
        brandUpdates.address_line1 = parsed.data.address_line1;
      }
      if (parsed.data.address_line2 !== undefined) {
        brandUpdates.address_line2 = parsed.data.address_line2;
      }
      if (parsed.data.address_city !== undefined) {
        brandUpdates.address_city = parsed.data.address_city;
      }
      if (parsed.data.address_postal_code !== undefined) {
        brandUpdates.address_postal_code = parsed.data.address_postal_code;
      }
      if (parsed.data.address_country !== undefined) {
        brandUpdates.address_country = parsed.data.address_country;
      }

      if (Object.keys(brandUpdates).length > 0) {
        brandUpdates.updated_at = new Date().toISOString();
        const { error: brandError } = await admin
          .from('profile_brands')
          .update(brandUpdates)
          .eq('user_id', user.id);

        if (brandError) {
          return formatErrorResponse(
            createError('DATABASE_ERROR', 'Erreur lors de la mise à jour du profil marque', 500, brandError)
          );
        }
      }
    }

    // Audit log
    const ipAddress = req.headers.get('x-forwarded-for') || undefined;
    const userAgent = req.headers.get('user-agent') || undefined;
    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'profile_complete',
      table_name: 'profiles',
      row_pk: user.id,
      new_values: parsed.data,
      ip: ipAddress,
      user_agent: userAgent,
    });

    // Récupérer le profil complet mis à jour
    const onboardingComplete = await computeOnboardingComplete(admin, role, user.id);

    const { error: flagError } = await admin
      .from('profiles')
      .update({
        onboarding_complete: onboardingComplete,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (flagError) {
      return formatErrorResponse(
        createError('DATABASE_ERROR', 'Erreur lors de la mise à jour du flag onboarding', 500, flagError)
      );
    }

    const { data: updatedProfile } = await admin
      .from('profiles')
      .select('id, role, email, display_name, avatar_url, bio, country, is_active, onboarding_complete')
      .eq('id', user.id)
      .single();

    return NextResponse.json({
      ok: true,
      user: updatedProfile,
      message: 'Onboarding complété avec succès',
    });
  } catch (error: unknown) {
    return formatErrorResponse(error);
  }
}
