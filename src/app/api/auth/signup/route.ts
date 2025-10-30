import { NextResponse } from "next/server";
import { SignupSchema } from "@/lib/schemas";
import { withRateLimit } from "@/lib/rate-limit";
import { ALLOWED_ORIGINS } from "@/lib/config";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { safeRedirect } from "@/lib/redirect";
import { logAudit } from "@/lib/audit";

function checkOrigin(req: Request): string | null {
  const origin = req.headers.get("origin");
  if (!origin) return null; // allow non-browser clients
  return ALLOWED_ORIGINS.has(origin) ? null : "Invalid origin";
}

export const POST = withRateLimit("/api/auth/signup", { maxRequests: 5, windowMs: 60_000 })(async (req: Request) => {
  const originError = checkOrigin(req);
  if (originError) {
    return NextResponse.json({ error: originError }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = SignupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { email, password, role } = parsed.data;
  const supabaseAdmin = getSupabaseAdmin();

  const emailRedirectTo = `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`;
  const { error } = await supabaseAdmin.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo,
      data: { role },
    },
  });

  if (error) {
    const message = error.message?.toLowerCase?.() || "signup_error";
    const isConflict = message.includes("already") || message.includes("registered") || message.includes("exists");
    return NextResponse.json({ error: error.message }, { status: isConflict ? 409 : 400 });
  }

  // audit log
  try {
    const ip = (req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "").split(",")[0] || null;
    await logAudit("auth_signup", null, ip);
  } catch {}

  // Redirect hint for clients: sanitize optional ?redirect against allowlist
  const url = new URL(req.url);
  const desired = url.searchParams.get("redirect");
  const redirect = safeRedirect(desired, role);
  return NextResponse.json({ success: true, redirect });
});

