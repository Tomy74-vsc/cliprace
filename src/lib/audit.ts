import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function logAudit(action: string, userId: string | null, ip?: string | null) {
  try {
    const admin = getSupabaseAdmin();
    await admin.from("audit_logs").insert({
      user_id: userId,
      action,
      ip: ip ?? null,
      timestamp: new Date().toISOString(),
    });
  } catch {
    // best-effort
  }
}


