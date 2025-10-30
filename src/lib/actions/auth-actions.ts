'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { observability } from '@/lib/observability';
import { signupSchema, creatorProfileSchema, brandProfileSchema } from '@/lib/server-validation';
import { z } from 'zod';

/**
 * Server Action pour l'inscription d'un utilisateur
 */
export async function signupAction(formData: FormData) {
  const startTime = Date.now();
  
  try {
    // Extraire les données du formulaire
    const rawData = {
      email: formData.get('email') as string,
      password: formData.get('password') as string,
      confirmPassword: formData.get('confirmPassword') as string,
      role: formData.get('role') as 'creator' | 'brand',
    };

    // Validation des données
    const validationResult = signupSchema.safeParse(rawData);
    if (!validationResult.success) {
      const errors = validationResult.error.issues.reduce((acc: Record<string, string>, error: z.ZodIssue) => {
        const path = error.path.join('.');
        acc[path] = error.message;
        return acc;
      }, {} as Record<string, string>);

      return {
        success: false,
        errors,
      };
    }

    const { email, password, role } = validationResult.data;

    // Log de l'événement
    observability.logAuthEvent({
      type: 'signup',
      success: false, // Sera mis à jour si succès
      context: {
        email,
        role,
        timestamp: new Date().toISOString(),
      },
    });

    // Créer l'utilisateur dans Supabase
    const supabase = await getServerSupabase();
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { 
          role,
          fullName: email.split('@')[0]
        },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/email-verified`,
      },
    });

    if (authError) {
      observability.logAuthError('signup', authError.message, {
        email,
        role,
        error: authError.message,
      });

      return {
        success: false,
        error: authError.message,
      };
    }

    if (authData.user) {
      // Log du succès
      observability.logAuthSuccess('signup', {
        userId: authData.user.id,
        email,
        role,
      });

      // Stocker temporairement les données pour l'étape suivante
      // En production, utiliser une base de données temporaire ou Redis
      // const tempData = {
      //   userId: authData.user.id,
      //   email,
      //   role,
      //   timestamp: Date.now(),
      // };

      // Rediriger vers la vérification email
      redirect('/auth/check-email');
    }

    return {
      success: false,
      error: 'Erreur lors de la création du compte',
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    
    observability.recordMetric({
      operation: 'signup_action',
      duration,
      success: false,
      context: {
        timestamp: new Date().toISOString(),
      },
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    return {
      success: false,
      error: 'Erreur interne du serveur',
    };
  }
}

/**
 * Server Action pour la connexion
 */
export async function loginAction(formData: FormData) {
  const startTime = Date.now();
  
  try {
    const rawData = {
      email: formData.get('email') as string,
      password: formData.get('password') as string,
    };

    // Validation
    const validationResult = z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }).safeParse(rawData);

    if (!validationResult.success) {
      return {
        success: false,
        error: 'Données invalides',
      };
    }

    const { email, password } = validationResult.data;

    // Log de l'événement
    observability.logAuthEvent({
      type: 'login',
      success: false,
      context: {
        email,
        timestamp: new Date().toISOString(),
      },
    });

    const supabase = await getServerSupabase();
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      observability.logAuthError('login', authError.message, {
        email,
        error: authError.message,
      });

      return {
        success: false,
        error: authError.message,
      };
    }

    if (authData.user) {
      observability.logAuthSuccess('login', {
        userId: authData.user.id,
        email,
      });

      // Rediriger vers la page appropriée selon le rôle
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', authData.user.id)
        .single();

      const redirectPath = profile?.role === 'brand' ? '/brand' : '/creator';
      redirect(redirectPath);
    }

    return {
      success: false,
      error: 'Erreur lors de la connexion',
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    
    observability.recordMetric({
      operation: 'login_action',
      duration,
      success: false,
      context: {
        timestamp: new Date().toISOString(),
      },
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    return {
      success: false,
      error: 'Erreur interne du serveur',
    };
  }
}

/**
 * Server Action pour la déconnexion
 */
export async function logoutAction() {
  try {
    const supabase = await getServerSupabase();
    const { error } = await supabase.auth.signOut();

    if (error) {
      observability.logAuthError('logout', error.message, {
        timestamp: new Date().toISOString(),
      });
      return { success: false, error: error.message };
    }

    observability.logAuthSuccess('logout', {
      timestamp: new Date().toISOString(),
    });

    revalidatePath('/');
    redirect('/');
  } catch {
    return {
      success: false,
      error: 'Erreur lors de la déconnexion',
    };
  }
}

/**
 * Server Action pour compléter le profil
 */
export async function completeProfileAction(formData: FormData) {
  const startTime = Date.now();
  
  try {
    const supabase = await getServerSupabase();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        success: false,
        error: 'Utilisateur non authentifié',
      };
    }

    // Extraire les données selon le rôle
    const role = formData.get('role') as 'creator' | 'brand';
    const rawData = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      website: formData.get('website') as string,
      country: formData.get('country') as string,
      ...(role === 'creator' ? {
        handle: formData.get('handle') as string,
        bio: formData.get('bio') as string,
        primaryNetwork: formData.get('primaryNetwork') as string,
      } : {
        companyName: formData.get('companyName') as string,
        legalName: formData.get('legalName') as string,
        vatNumber: formData.get('vatNumber') as string,
        address: formData.get('address') as string,
        city: formData.get('city') as string,
        industry: formData.get('industry') as string,
        companySize: formData.get('companySize') as string,
      }),
    };

    // Validation selon le rôle
    const schema = role === 'creator' ? creatorProfileSchema : brandProfileSchema;
    const validationResult = schema.safeParse(rawData);

    if (!validationResult.success) {
      const errors = validationResult.error.issues.reduce((acc: Record<string, string>, error: z.ZodIssue) => {
        const path = error.path.join('.');
        acc[path] = error.message;
        return acc;
      }, {} as Record<string, string>);

      return {
        success: false,
        errors,
      };
    }

    const validatedData = validationResult.data;

    // Créer le profil principal
    const { error: profileError } = await supabase
      .from('profiles')
      .insert([{
        id: user.id,
        email: user.email!,
        role,
        name: validatedData.name,
        description: validatedData.description,
        website: validatedData.website || null,
        country: validatedData.country || 'FR',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }]);

    if (profileError) {
      observability.logAuthError('auth_error', profileError.message, {
        userId: user.id,
        role,
      });
      return {
        success: false,
        error: 'Erreur lors de la création du profil',
      };
    }

    // Créer le profil spécifique selon le rôle
    if (role === 'creator') {
      const creatorData = validatedData as Record<string, unknown>;
      const { error: creatorError } = await supabase
        .from('profiles_creator')
        .insert([{
          user_id: user.id,
          handle: creatorData.handle,
          bio: creatorData.bio || null,
          country: validatedData.country || 'FR',
          primary_network: creatorData.primaryNetwork || 'tiktok',
          social_media: creatorData.socialMedia || {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }]);

      if (creatorError) {
        return {
          success: false,
          error: 'Erreur lors de la création du profil créateur',
        };
      }
    } else {
      const brandData = validatedData as Record<string, unknown>;
      const { error: brandError } = await supabase
        .from('profiles_brand')
        .insert([{
          user_id: user.id,
          company_name: brandData.companyName,
          legal_name: brandData.legalName,
          vat_number: brandData.vatNumber || null,
          address: brandData.address || null,
          city: brandData.city || null,
          country: validatedData.country || 'FR',
          website: validatedData.website || null,
          industry: brandData.industry || null,
          company_size: brandData.companySize || null,
          description: validatedData.description || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }]);

      if (brandError) {
        return {
          success: false,
          error: 'Erreur lors de la création du profil marque',
        };
      }
    }

    observability.logAuthSuccess('signup', {
      userId: user.id,
      role,
    });

    revalidatePath('/');
    redirect(role === 'brand' ? '/brand' : '/creator');

  } catch (error) {
    const duration = Date.now() - startTime;
    
    observability.recordMetric({
      operation: 'complete_profile_action',
      duration,
      success: false,
      context: {
        timestamp: new Date().toISOString(),
      },
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    return {
      success: false,
      error: 'Erreur interne du serveur',
    };
  }
}

/**
 * Server Action historique pour CSRF — retourne désormais un token vide.
 */
export async function getCSRFTokenAction() {
  return { success: true, token: "" };
}
