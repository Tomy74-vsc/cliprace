/**
 * Supabase Admin Client
 * Client with service role for administrative operations
 * 
 * SECURITY: This file must NEVER be imported on the client side
 */

import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

// Guard against client-side import
if (typeof window !== "undefined") {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY must never be imported client-side. This file should only be used in server-side code (API routes, server components).");
}

let adminClient: ReturnType<typeof createClient> | null = null;

/**
 * Returns the Supabase client initialised with the service role
 */
export function getAdminSupabase() {
  if (!adminClient) {
    // Use validated environment variables from env.ts
    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

    adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return adminClient;
}

/**
 * Deletes a user with the service role
 */
export async function deleteUserWithServiceRole(userId: string) {
  const supabase = getAdminSupabase();
  
  try {
    // Delete the user via the admin API
    const { data, error } = await supabase.auth.admin.deleteUser(userId);
    
    if (error) {
      throw new Error(`Failed to delete user: ${error.message}`);
    }
    
    return { success: true, data };
  } catch (error) {
    console.error('Error deleting user with service role:', error);
    throw error;
  }
}

/**
 * Executes a SQL query with the service role
 */
export async function executeSqlWithServiceRole(sql: string) {
  const supabase = getAdminSupabase();
  
  try {
    const { data, error } = await (supabase as any).rpc('exec_sql', { query: sql });
    
    if (error) {
      throw new Error(`SQL execution failed: ${error.message}`);
    }
    
    return { success: true, data };
  } catch (error) {
    console.error('Error executing SQL with service role:', error);
    throw error;
  }
}


