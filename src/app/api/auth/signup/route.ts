// Source: POST /api/auth/signup (§6, §1164-1167, §190)
// Effects: create user + profiles + role-specific row (service role)
import { NextRequest, NextResponse } from 'next/server';
import { signupSchema } from '@/lib/validators/auth';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rateLimit';
import { formatErrorResponse, createError } from '@/lib/errors';
import { assertCsrf } from '@/lib/csrf';
import type { ProfileInsert, ProfileCreatorInsert, ProfileBrandInsert } from '@/types/db';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

export async function POST(req: NextRequest) {
  try {
    // Rate limiting: 5 req/min par IP (§4, §152)
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    const rlKey = `auth:signup:${ip}`;
    if (!(await rateLimit({ key: rlKey, route: 'auth:signup', windowMs: 60 * 1000, max: 5 }))) {
      return formatErrorResponse(createError('RATE_LIMIT', 'Trop de tentatives. Réessayez dans 1 minute.', 429));
    }

    // CSRF check (double-submit: cookie must match header)
    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch (csrfError) {
      return formatErrorResponse(
        createError('FORBIDDEN', 'Token CSRF invalide', 403, csrfError)
      );
    }

    const body = await req.json();
    const parsed = signupSchema.safeParse(body);
    
    if (!parsed.success) {
      return formatErrorResponse(
        createError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.flatten())
      );
    }


    const { email, password, role, profileFields } = parsed.data;
    const admin = getSupabaseAdmin();

    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Missing Supabase env vars:', {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseAnonKey,
      });
      return formatErrorResponse(
        createError('DATABASE_ERROR', 'Configuration serveur manquante. Veuillez contacter le support.', 500)
      );
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const siteUrl = env.NEXT_PUBLIC_SITE_URL || env.APP_URL || 'http://localhost:3000';
    const redirectUrl = `${siteUrl}/auth/verify?email=${encodeURIComponent(email)}`;
    
    console.log('Attempting signup for:', { 
      email, 
      role, 
      siteUrl,
      redirectUrl,
      supabaseUrl: supabaseUrl ? '✅' : '❌',
      supabaseAnonKey: supabaseAnonKey ? '✅' : '❌',
    });

    const { data: signUpData, error: signUpError } = await authClient.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { role },
        // S'assurer que l'email est envoyé
        captchaToken: undefined, // Pas de captcha pour l'instant
      },
    });

    if (signUpError || !signUpData.user) {
      console.error('Signup error from Supabase:', signUpError);
      
      const errorMsg = signUpError?.message?.toLowerCase() || '';
      
      // Email déjà utilisé
      if (errorMsg.includes('registered') || errorMsg.includes('already registered')) {
        return formatErrorResponse(createError('CONFLICT', 'Cet email est déjà utilisé', 409, signUpError));
      }
      
      // Rate limit email (trop d'emails envoyés)
      if (errorMsg.includes('rate limit') || errorMsg.includes('email rate limit')) {
        return formatErrorResponse(
          createError('RATE_LIMIT', 'Trop d\'emails ont été envoyés récemment. Veuillez attendre quelques minutes avant de réessayer.', 429, signUpError)
        );
      }
      
      // Autres erreurs
      return formatErrorResponse(
        createError('DATABASE_ERROR', `Erreur lors de la création du compte: ${signUpError?.message || 'Erreur inconnue'}`, 500, signUpError)
      );
    }
    
    console.log('User created successfully:', {
      userId: signUpData.user.id,
      email: signUpData.user.email,
      emailConfirmed: !!signUpData.user.email_confirmed_at,
      session: signUpData.session ? '✅' : '❌',
    });

    // Vérifier si l'email a été envoyé
    if (!signUpData.user.email_confirmed_at) {
      console.log('Email verification required - email should have been sent');
    } else {
      console.warn('User email already confirmed - this is unexpected for new signup');
    }

    const userId = signUpData.user.id;
    
    
    // Insérer dans profiles (service role)
    const profileData: ProfileInsert = {
      id: userId,
      role,
      email: email.toLowerCase(),
      display_name: profileFields?.display_name || null,
      bio: profileFields?.bio || null,
      country: profileFields?.country || 'FR',
      is_active: true,
      onboarding_complete: false,
    };

    const { error: profileError } = await admin
      .from('profiles')
      .insert(profileData);

    if (profileError) {
      console.error('Profile creation error:', profileError);
      // Rollback: supprimer l'utilisateur auth si profiles échoue
      try {
        await admin.auth.admin.deleteUser(userId);
      } catch (deleteError) {
        console.error('Failed to delete user during rollback:', deleteError);
      }
      return formatErrorResponse(
        createError('DATABASE_ERROR', `Erreur lors de la création du profil: ${profileError.message || 'Erreur inconnue'}`, 500, profileError)
      );
    }
    
    console.log('Profile created successfully');

    // Insérer dans profile_creators ou profile_brands selon le rôle
    if (role === 'creator') {
      const creatorData: ProfileCreatorInsert = {
        user_id: userId,
        handle: profileFields?.username || null,
        primary_platform: profileFields?.primary_platform || 'tiktok',
      };

      const { error: creatorError } = await admin
        .from('profile_creators')
        .insert(creatorData);

      if (creatorError) {
        console.error('Creator profile creation error:', creatorError);
        // Rollback partiel: supprimer profiles et auth user
        try {
          await admin.from('profiles').delete().eq('id', userId);
          await admin.auth.admin.deleteUser(userId);
        } catch (rollbackError) {
          console.error('Rollback error:', rollbackError);
        }
        return formatErrorResponse(
          createError('DATABASE_ERROR', `Erreur lors de la création du profil créateur: ${creatorError.message || 'Erreur inconnue'}`, 500, creatorError)
        );
      }
      
      console.log('Creator profile created successfully');
    } else if (role === 'brand') {
      const brandData: ProfileBrandInsert = {
        user_id: userId,
        company_name: profileFields?.company_name || 'Entreprise',
        vat_number: profileFields?.vat_number || null,
      };

      const { error: brandError } = await admin
        .from('profile_brands')
        .insert(brandData);

      if (brandError) {
        console.error('Brand profile creation error:', brandError);
        // Rollback partiel
        try {
          await admin.from('profiles').delete().eq('id', userId);
          await admin.auth.admin.deleteUser(userId);
        } catch (rollbackError) {
          console.error('Rollback error:', rollbackError);
        }
        return formatErrorResponse(
          createError('DATABASE_ERROR', `Erreur lors de la création du profil marque: ${brandError.message || 'Erreur inconnue'}`, 500, brandError)
        );
      }
      
      console.log('Brand profile created successfully');
    }

    // Audit log
    const ipAddress = req.headers.get('x-forwarded-for') || undefined;
    const userAgent = req.headers.get('user-agent') || undefined;
    await admin.from('audit_logs').insert({
      actor_id: userId,
      action: 'user_signup',
      table_name: 'profiles',
      row_pk: userId,
      new_values: { email, role },
      ip: ipAddress,
      user_agent: userAgent,
    });

    // Retourner session + profil + rôle
    // Note: Pour obtenir une session, on peut utiliser signInWithPassword côté client
    // Ici on retourne juste les infos nécessaires pour rediriger
    return NextResponse.json({
      ok: true,
      user: {
        id: userId,
        email: signUpData.user.email,
        role,
      },
      requires_email_verification: !signUpData.user.email_confirmed_at,
    });
  } catch (error: unknown) {
    // Log l'erreur pour le debugging
    console.error('Signup error:', error);
    
    // Si c'est une Error, logger le message et la stack
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    return formatErrorResponse(error);
  }
}
