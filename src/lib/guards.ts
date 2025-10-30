import { getServerSupabase } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function getUserAndRole() {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.auth.getUser();
  const user = data?.user ?? null;
  const role = (user?.user_metadata as any)?.role ?? null;
  return { user, role, error: error ?? null } as const;
}

function decodeJwt(token: string): any | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(payload, "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export async function verifyBearer(req: Request): Promise<{ ok: boolean; userId?: string; error?: string }> {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";

  // Hard fail if service role key is seen in request
  if (token && process.env.SUPABASE_SERVICE_ROLE_KEY && token === process.env.SUPABASE_SERVICE_ROLE_KEY) {
    await logInvalidAttempt(req, null, "service_role_in_header");
    return { ok: false, error: "Invalid token" };
  }

  if (!token) {
    return { ok: false, error: "Missing token" };
  }

  // Basic JWT claims validation (iss, exp)
  const claims = decodeJwt(token);
  if (!claims) {
    await logInvalidAttempt(req, null, "invalid_jwt");
    return { ok: false, error: "Invalid token" };
  }
  const iss = String(claims.iss || "");
  const exp = Number(claims.exp || 0);
  const now = Math.floor(Date.now() / 1000);
  if (!iss.includes("supabase.co") && !iss.includes("supabase.com")) {
    await logInvalidAttempt(req, claims.sub || null, "bad_issuer");
    return { ok: false, error: "Invalid token" };
  }
  if (!exp || exp <= now) {
    await logInvalidAttempt(req, claims.sub || null, "token_expired");
    return { ok: false, error: "Expired token" };
  }

  // Validate token with Supabase (ensures signature/subject)
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) {
    await logInvalidAttempt(req, claims.sub || null, "getUser_failed");
    return { ok: false, error: "Unauthorized" };
  }
  return { ok: true, userId: data.user.id };
}

async function logInvalidAttempt(req: Request, userId: string | null, reason: string) {
  try {
    const admin = getSupabaseAdmin();
    const ip = (req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "").split(",")[0] || null;
    const route = new URL(req.url).pathname;
    await admin.from("audit_logs").insert({
      actor_id: userId,
      action: "auth_bearer_invalid",
      target: route,
      metadata: { ip, reason },
      created_at: new Date().toISOString(),
    });
  } catch {
    // ignore
  }
}


