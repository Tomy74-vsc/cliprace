import { createBrowserClient } from "@supabase/ssr";

/**
 * Configuration Supabase SSR optimisée pour le navigateur
 * Gère automatiquement les cookies de session côté client
 */
export function getBrowserSupabase() {
	return createBrowserClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
	);
}

/**
 * Récupère l'utilisateur actuel côté client
 * @returns L'utilisateur authentifié ou null
 */
export async function getBrowserUser() {
	try {
		const supabase = getBrowserSupabase();
		const { data: { user }, error } = await supabase.auth.getUser();
		
		if (error) {
			if (process.env.NODE_ENV === 'development') {
				console.error('Erreur lors de la récupération de l\'utilisateur client:', error);
			}
			return null;
		}
		
		return user;
	} catch (error) {
		if (process.env.NODE_ENV === 'development') {
			console.error('Erreur inattendue lors de la récupération de l\'utilisateur:', error);
		}
		return null;
	}
}

/**
 * Récupère la session actuelle côté client
 * @returns La session active ou null
 */
export async function getBrowserSession() {
	try {
		const supabase = getBrowserSupabase();
		const { data: { session }, error } = await supabase.auth.getSession();
		
		if (error) {
			if (process.env.NODE_ENV === 'development') {
				console.error('Erreur lors de la récupération de la session client:', error);
			}
			return null;
		}
		
		return session;
	} catch (error) {
		if (process.env.NODE_ENV === 'development') {
			console.error('Erreur inattendue lors de la récupération de la session:', error);
		}
		return null;
	}
}

/**
 * Force la purge complète des sessions Supabase côté client
 * Version améliorée pour éviter les conflits de session
 * @returns true si la purge a réussi, false sinon
 */
export async function forceSessionCleanup() {
	try {
		const supabase = getBrowserSupabase();
		
		// Vérifier d'abord s'il y a une session active
		const { data: { session } } = await supabase.auth.getSession();
		if (!session) {
			// Pas de session active, nettoyer quand même le localStorage
			try {
				localStorage.removeItem('signup_user_data');
			} catch (storageError) {
				if (process.env.NODE_ENV === 'development') {
					console.warn('Erreur lors du nettoyage du localStorage:', storageError);
				}
			}
			return true;
		}
		
		// Forcer la déconnexion seulement si une session existe
		const { error: signOutError } = await supabase.auth.signOut();
		
		if (signOutError) {
			if (process.env.NODE_ENV === 'development') {
				console.warn('Erreur lors de la purge des sessions:', signOutError);
			}
			// Même en cas d'erreur, nettoyer le localStorage
			try {
				localStorage.removeItem('signup_user_data');
			} catch (storageError) {
				// Ignore storage errors
			}
			return false;
		}
		
		// Nettoyer le localStorage des données d'inscription
		try {
			localStorage.removeItem('signup_user_data');
		} catch (storageError) {
			if (process.env.NODE_ENV === 'development') {
				console.warn('Erreur lors du nettoyage du localStorage:', storageError);
			}
		}
		
		// Attendre un peu pour que la déconnexion se propage
		await new Promise(resolve => setTimeout(resolve, 100));
		
		if (process.env.NODE_ENV === 'development') {
			console.log('Purge des sessions réussie');
		}
		
		return true;
	} catch (error) {
		if (process.env.NODE_ENV === 'development') {
			console.error('Erreur inattendue lors de la purge des sessions:', error);
		}
		return false;
	}
}

/**
 * Vérifie si l'utilisateur actuel a un email confirmé
 * @returns true si l'email est confirmé, false sinon
 */
export async function isEmailVerified() {
	try {
		const supabase = getBrowserSupabase();
		
		// Vérifier d'abord la session
		const { data: { session }, error: sessionError } = await supabase.auth.getSession();
		
		if (sessionError || !session) {
			return false;
		}
		
		// Vérifier l'utilisateur
		const { data: { user }, error: userError } = await supabase.auth.getUser();
		
		if (userError || !user) {
			return false;
		}
		
		// Vérifier que l'email est confirmé
		if (!user.email_confirmed_at) {
			return false;
		}
		
		// Double vérification : s'assurer que la session correspond à un utilisateur vérifié
		if (session.user.email_confirmed_at !== user.email_confirmed_at) {
			return false;
		}
		
		return true;
	} catch (error) {
		if (process.env.NODE_ENV === 'development') {
			console.error('Erreur lors de la vérification de l\'email:', error);
		}
		return false;
	}
}

/**
 * Crée un client Supabase pour le navigateur
 * Compatible avec l'ancienne API
 */
export function createClient() {
	return getBrowserSupabase();
}


