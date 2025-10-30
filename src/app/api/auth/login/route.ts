import { NextResponse } from "next/server";
import { LoginSchema } from "@/lib/schemas";
import { withRateLimit } from "@/lib/rate-limit";
import { ALLOWED_ORIGINS } from "@/lib/config";
import { getServerSupabase } from "@/lib/supabase/server";
import { safeRedirect } from "@/lib/redirect";
import { logAudit } from "@/lib/audit";

function checkOrigin(req: Request): string | null {
  const origin = req.headers.get("origin");
  if (!origin) return null; // allow non-browser clients
  return ALLOWED_ORIGINS.has(origin) ? null : "Invalid origin";
}

export const POST = withRateLimit("/api/auth/login", { maxRequests: 5, windowMs: 60_000 })(async (req: Request) => {
  const originError = checkOrigin(req);
  if (originError) {
    return NextResponse.json({ error: originError }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" });
  }

  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.flatten() });
  }

  const supabase = await getServerSupabase();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error || !data?.session) {
    return NextResponse.json({ success: false, error: error?.message ?? "Invalid credentials" });
  }

  // Compute a safe redirect based on optional ?redirect and user role
  const url = new URL(req.url);
  const desired = url.searchParams.get("redirect");
  const role = (data.user?.user_metadata as any)?.role ?? null;
  const redirect = safeRedirect(desired, role);

  // audit log
  try {
    const ip = (req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "").split(",")[0] || null;
    await logAudit("auth_login", data.user?.id ?? null, ip);
  } catch {}

  return NextResponse.json({
    success: true,
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    redirect,
  });
});
