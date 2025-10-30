/**
 * Utilitaire pour créer des clients PostgreSQL avec JWT
 * Utilisé pour tester RLS avec différents rôles utilisateur
 */

import { Client } from 'pg';
import jwt from 'jsonwebtoken';

interface PgClientConfig {
  role: 'anon' | 'authenticated' | 'service_role';
  jwtSub?: string;
  jwtClaims?: Record<string, any>;
}

/**
 * Crée un client PostgreSQL avec un rôle JWT spécifique
 */
export function createPgClient(config: PgClientConfig): Client {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
  });

  return client;
}

/**
 * Connecte un client et configure le rôle JWT
 */
export async function connectPgClient(client: Client, config: PgClientConfig): Promise<void> {
  await client.connect();

  // Configuration JWT pour les tests
  if (config.role === 'anon') {
    // Utilisateur anonyme - pas de JWT
    await client.query('SET ROLE anon;');
  } else if (config.role === 'authenticated') {
    // Utilisateur authentifié avec JWT
    const token = createTestJWT(config.jwtSub || 'test-user-id', config.jwtClaims);
    await client.query(`SET LOCAL "request.jwt.claims" TO '${JSON.stringify(token)}';`);
    await client.query('SET ROLE authenticated;');
  } else if (config.role === 'service_role') {
    // Service role - accès complet
    await client.query('SET ROLE service_role;');
  }
}

/**
 * Crée un JWT de test pour les tests RLS
 */
function createTestJWT(sub: string, claims: Record<string, any> = {}): Record<string, any> {
  return {
    sub,
    aud: 'authenticated',
    role: 'authenticated',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...claims
  };
}

/**
 * Crée un client avec un utilisateur créateur
 */
export function createCreatorClient(userId: string = 'creator-user-id'): Client {
  return createPgClient({
    role: 'authenticated',
    jwtSub: userId,
    jwtClaims: {
      email: 'creator@test.com',
      role: 'creator'
    }
  });
}

/**
 * Crée un client avec un utilisateur brand/admin
 */
export function createAdminClient(userId: string = 'admin-user-id'): Client {
  return createPgClient({
    role: 'authenticated',
    jwtSub: userId,
    jwtClaims: {
      email: 'admin@test.com',
      role: 'admin'
    }
  });
}

/**
 * Crée un client anonyme
 */
export function createAnonClient(): Client {
  return createPgClient({
    role: 'anon'
  });
}

/**
 * Crée un client service role
 */
export function createServiceRoleClient(): Client {
  return createPgClient({
    role: 'service_role'
  });
}

/**
 * Crée et connecte un client avec un utilisateur créateur
 */
export async function createAndConnectCreatorClient(userId: string = 'creator-user-id'): Promise<Client> {
  const client = createCreatorClient(userId);
  await connectPgClient(client, {
    role: 'authenticated',
    jwtSub: userId,
    jwtClaims: {
      email: 'creator@test.com',
      role: 'creator'
    }
  });
  return client;
}

/**
 * Crée et connecte un client avec un utilisateur admin
 */
export async function createAndConnectAdminClient(userId: string = 'admin-user-id'): Promise<Client> {
  const client = createAdminClient(userId);
  await connectPgClient(client, {
    role: 'authenticated',
    jwtSub: userId,
    jwtClaims: {
      email: 'admin@test.com',
      role: 'admin'
    }
  });
  return client;
}

/**
 * Crée et connecte un client anonyme
 */
export async function createAndConnectAnonClient(): Promise<Client> {
  const client = createAnonClient();
  await connectPgClient(client, { role: 'anon' });
  return client;
}

/**
 * Crée et connecte un client service role
 */
export async function createAndConnectServiceRoleClient(): Promise<Client> {
  const client = createServiceRoleClient();
  await connectPgClient(client, { role: 'service_role' });
  return client;
}

/**
 * Exécute une requête avec gestion d'erreur RLS
 */
export async function executeWithRLS(
  client: Client,
  query: string,
  params: any[] = []
): Promise<{ success: boolean; error?: string; data?: any[] }> {
  try {
    const result = await client.query(query, params);
    return { success: true, data: result.rows };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Vérifie qu'une requête échoue à cause de RLS
 * Retourne true si l'erreur est bien une erreur RLS (42501/insufficient_privilege)
 */
export async function expectRLSFailure(
  client: Client,
  query: string,
  params: any[] = []
): Promise<boolean> {
  const result = await executeWithRLS(client, query, params);
  return !result.success && (
    result.error?.includes('permission denied') ||
    result.error?.includes('insufficient privilege') ||
    result.error?.includes('row level security') ||
    result.error?.includes('42501')
  );
}

/**
 * Vérifie qu'une requête réussit (pour admin/service-role)
 * Retourne true si la requête passe sans erreur RLS
 */
export async function expectRLSPass(
  client: Client,
  query: string,
  params: any[] = []
): Promise<boolean> {
  const result = await executeWithRLS(client, query, params);
  return result.success;
}
