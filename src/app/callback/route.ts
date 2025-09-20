import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");

  await cookies();
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {}
  );

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  }

  // Si l’email doit être confirmé, Supabase le gère côté provider/email.
  // On redirige vers l’onboarding si nouveau, sinon vers l’app (on affinera après).
  return NextResponse.redirect(new URL("/onboarding", req.url));
}
