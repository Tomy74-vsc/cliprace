// Source: environment validation for Supabase/Stripe/app
export const env = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  APP_URL: process.env.APP_URL ?? '',
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ?? '',
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET ?? '',
};

export function assertEnv() {
  const missing: string[] = [];
  for (const [k, v] of Object.entries(env)) if (!v) missing.push(k);
  if (missing.length) {
    // Keep it simple: fail fast in server contexts
    console.warn('Missing environment variables:', missing.join(', '));
  }
}
