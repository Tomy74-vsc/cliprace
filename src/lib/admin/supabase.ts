import { getSupabaseAdmin } from '@/lib/supabase/server';

export function getAdminClient() {
  return getSupabaseAdmin();
}
