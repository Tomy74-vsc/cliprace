/**
 * Environment Variables Validation
 * 
 * This file validates required environment variables at runtime using Zod.
 * Import this file in critical handlers to fail-fast if required variables are missing.
 * 
 * SECURITY: SUPABASE_SERVICE_ROLE_KEY must never be exposed to the client.
 */

import { z } from "zod";

// Define the environment schema
const EnvSchema = z.object({
  // Public variables (safe for client)
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(10, "NEXT_PUBLIC_SUPABASE_ANON_KEY must be at least 10 characters"),
  
  // Server-only variables
  SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL").optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10, "SUPABASE_SERVICE_ROLE_KEY must be at least 10 characters"),
  
  // App configuration
  NEXT_PUBLIC_APP_URL: z.string().url("NEXT_PUBLIC_APP_URL must be a valid URL").optional(),
  NEXT_PUBLIC_SITE_URL: z.string().url("NEXT_PUBLIC_SITE_URL must be a valid URL").optional(),
  
  // Node environment
  NODE_ENV: z.enum(["development", "production", "test"]).optional(),
});

/**
 * Validated environment variables
 * 
 * Usage:
 * ```typescript
 * import { env } from '@/lib/env';
 * 
 * const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
 * const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY; // Server-side only!
 * ```
 */
export const env = EnvSchema.parse(process.env);

/**
 * Type-safe environment variables
 */
export type Env = z.infer<typeof EnvSchema>;

/**
 * Validate specific server-side variables
 * Use this in API routes to ensure critical variables are present
 */
export function validateServerEnv(): void {
  if (typeof window !== "undefined") {
    throw new Error("validateServerEnv() should only be called server-side");
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for server-side operations");
  }
}

/**
 * Validate client-safe variables only
 * Use this for client-side validation
 */
export function validateClientEnv(): void {
  const ClientEnvSchema = z.object({
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(10),
    NEXT_PUBLIC_APP_URL: z.string().url().optional(),
    NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  });

  ClientEnvSchema.parse(process.env);
}

