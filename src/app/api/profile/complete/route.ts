import { NextResponse } from "next/server";
import { z } from "zod";
import { CompleteProfileSchema } from "@/lib/schemas";
import { withRateLimit } from "@/lib/rate-limit";
import { ALLOWED_ORIGINS } from "@/lib/config";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { verifyBearer } from "@/lib/guards";
import { logAudit } from "@/lib/audit";

function checkOrigin(req: Request): string | null {
  const origin = req.headers.get("origin");
  if (!origin) return null; // allow non-browser clients
  return ALLOWED_ORIGINS.has(origin) ? null : "Invalid origin";
}

function getBearer(req: Request): string | null {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!auth) return null;
  const m = auth.match(/^Bearer (.+)$/i);
  return m ? m[1] : null;
}

export const POST = withRateLimit("/api/profile/complete", { maxRequests: 5, windowMs: 60_000 })(async (req: Request) => {
  const originError = checkOrigin(req);
  if (originError) {
    return NextResponse.json({ error: originError }, { status: 400 });
  }

  const token = getBearer(req);
  if (!token) {
    return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
  }

  const verification = await verifyBearer(req);
  if (!verification.ok || !verification.userId) {
    return NextResponse.json({ error: verification.error || "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CompleteProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const userId = verification.userId;
  // fetch user details (email/metadata) to determine role
  const { data: userData } = await supabaseAdmin.auth.getUser(token);
  const user = userData?.user!;
  const role = (user.user_metadata as any)?.role || parsed.data.role;
  const name = parsed.data.name;

  // Upsert into profiles
  const { error: upsertErr } = await supabaseAdmin
    .from("profiles")
    .upsert({ id: userId, name, email: user.email }, { onConflict: "id" });
  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 400 });
  }

  if (role === "creator") {
    await supabaseAdmin
      .from("profiles_creator")
      .upsert({ user_id: userId }, { onConflict: "user_id" });
  } else if (role === "brand") {
    await supabaseAdmin
      .from("profiles_brand")
      .upsert({ user_id: userId }, { onConflict: "user_id" });
  }

  // audit log
  try {
    const ip = (req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "").split(",")[0] || null;
    await logAudit("profile_complete", userId, ip);
  } catch {}

  return NextResponse.json({ success: true });
});


