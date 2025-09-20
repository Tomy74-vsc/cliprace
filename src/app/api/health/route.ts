import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("now"); // On créera la fonction plus bas
  return NextResponse.json({ ok: !error, data, error: error?.message ?? null });
}
