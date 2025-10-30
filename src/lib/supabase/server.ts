import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config";
import { supabaseCookieOptions } from "@/lib/cookies";
import type { User, Session } from "./types";

/**
 * Configuration Supabase SSR optimisée pour le serveur
 * Gère automatiquement les cookies de session
 */
export async function getServerSupabase() {
	const cookieStore = await cookies();
    const config = getSupabaseConfig();
	
	return createServerClient(
		config.url,
		config.anonKey,
		{
			cookies: {
				get(name: string) {
					const cookie = cookieStore.get(name);
					return cookie?.value;
				},
                set(name: string, value: string, options: any) {
					try {
                        // Always enforce hardened cookie attributes; overwrite rotates refresh token cookies
                        cookieStore.set(name, value, {
                            ...options,
                            ...supabaseCookieOptions(),
                        });
					} catch (error) {
						if (process.env.NODE_ENV === 'development') {
							console.error('Erreur lors de la définition des cookies:', error);
						}
					}
				},
			},
		}
	);
}

/**
 * Client Supabase avec service role pour opérations critiques côté serveur
 */
export function getSupabaseAdmin() {
    const { url, serviceRoleKey } = getSupabaseConfig();
    return createSupabaseAdminClient(url, serviceRoleKey!);
}

/**
 * Récupère l'utilisateur actuel côté serveur
 * @returns L'utilisateur authentifié ou null
 */
export async function getServerUser(): Promise<User | null> {
	try {
		const supabase = await getServerSupabase();
		const { data: { user }, error } = await supabase.auth.getUser();
		
		if (error) {
			// Log seulement en développement pour éviter les logs en production
			if (process.env.NODE_ENV === 'development') {
				console.error('Erreur lors de la récupération de l\'utilisateur serveur:', error);
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
 * Récupère la session actuelle côté serveur
 * @returns La session active ou null
 */
export async function getServerSession(): Promise<Session | null> {
	try {
		const supabase = await getServerSupabase();
		const { data: { session }, error } = await supabase.auth.getSession();
		
		if (error) {
			if (process.env.NODE_ENV === 'development') {
				console.error('Erreur lors de la récupération de la session serveur:', error);
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
 * Vérifie si l'utilisateur est authentifié côté serveur
 * @returns true si l'utilisateur est authentifié, false sinon
 */
export async function isAuthenticated(): Promise<boolean> {
	const user = await getServerUser();
	return user !== null;
}

/**
 * Récupère l'ID de l'utilisateur actuel côté serveur
 * @returns L'ID de l'utilisateur ou null
 */
export async function getCurrentUserId(): Promise<string | null> {
	const user = await getServerUser();
	return user?.id || null;
}

/**
 * Crée un client Supabase pour les API routes
 * Compatible avec l'ancienne API
 */
export async function createClient() {
	return await getServerSupabase();
}


