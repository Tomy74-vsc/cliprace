// Source: Supabase browser client (anon) — RLS enforced
// Utilise createBrowserClient de @supabase/ssr pour synchroniser avec les cookies Next.js
import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

