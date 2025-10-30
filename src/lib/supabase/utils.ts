import { getBrowserSupabase } from "./client";

/**
 * Vérifie la configuration et la connexion Supabase
 */
export async function checkSupabaseConnection() {
  const supabase = getBrowserSupabase();
  
  try {
    // Test de connexion basique avec une table qui existe
    const { error } = await supabase.from('profiles').select('id').limit(1);
    
    if (error) {
      return {
        success: false,
        error: `Erreur de connexion: ${error.message}`,
        code: error.code
      };
    }
    
    return {
      success: true,
      message: 'Connexion Supabase OK'
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur inconnue'
    };
  }
}

/**
 * Vérifie si l'utilisateur est correctement authentifié
 */
export async function checkUserAuth() {
  const supabase = getBrowserSupabase();
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      return {
        success: false,
        error: `Erreur d'authentification: ${error.message}`,
        code: error.code
      };
    }
    
    if (!user) {
      return {
        success: false,
        error: 'Aucun utilisateur authentifié'
      };
    }
    
    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        email_confirmed_at: user.email_confirmed_at,
        created_at: user.created_at
      }
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur inconnue'
    };
  }
}

/**
 * Vérifie si les tables de profils existent
 */
export async function checkProfileTables() {
  const supabase = getBrowserSupabase();
  
  try {
    // Test des tables de profils
    const [creatorResult, brandResult] = await Promise.allSettled([
      supabase.from('profiles_creator').select('id').limit(1),
      supabase.from('profiles_brand').select('id').limit(1)
    ]);
    
    const results = {
      profiles_creator: creatorResult.status === 'fulfilled' ? 'OK' : 'Erreur',
      profiles_brand: brandResult.status === 'fulfilled' ? 'OK' : 'Erreur'
    };
    
    return {
      success: true,
      tables: results
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur inconnue'
    };
  }
}
