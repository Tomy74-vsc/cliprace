import { NextResponse } from "next/server";
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

export const POST = withRateLimit("/api/uploads/avatar", { maxRequests: 5, windowMs: 60_000 })(async (req: Request) => {
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

  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData } = await supabaseAdmin.auth.getUser(token);

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid form-data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file field" }, { status: 400 });
  }

  // Validation: taille <= 2 Mo et type image/*
  const MAX_BYTES = 2 * 1024 * 1024;
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 2MB)" }, { status: 413 });
  }
  if (!file.type || !file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
  }

  // Lecture du fichier
  const inputBuffer = Buffer.from(await file.arrayBuffer());

  // Traitement image sécurisé: supprime EXIF, corrige orientation, convertit en WebP
  let outputBuffer: Uint8Array;
  try {
    // Import dynamique pour éviter le coût si non utilisé
    const sharp = (await import("sharp")).default;
    const processed = await sharp(inputBuffer)
      .rotate() // utilise l'EXIF si présent puis le supprime
      .toFormat("webp", { quality: 85 })
      .toBuffer();
    outputBuffer = new Uint8Array(processed);
  } catch (e) {
    // Si sharp n'est pas disponible, refuser afin d'éviter d'uploader des images non nettoyées
    return NextResponse.json({ error: "Image processing unavailable on server" }, { status: 500 });
  }

  // Génère un nom de fichier stable: userId/timestamp.webp
  const userId = verification.userId;
  const path = `${userId}/${Date.now()}.webp`;

  // Upload vers le bucket avatars (public)
  const { error: uploadErr } = await supabaseAdmin.storage
    .from("avatars")
    .upload(path, outputBuffer, {
      contentType: "image/webp",
      upsert: true,
    });

  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 400 });
  }

  const { data: pub } = supabaseAdmin.storage.from("avatars").getPublicUrl(path);

  // Journalisation dans audit_logs (best-effort)
  try {
    const ip = (req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "").split(",")[0] || null;
    await logAudit("upload_avatar", userId, ip);
  } catch {
    // ignore logging errors
  }

  return NextResponse.json({ publicUrl: pub.publicUrl });
});


