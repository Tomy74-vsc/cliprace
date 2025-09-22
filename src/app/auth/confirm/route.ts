import { NextRequest } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
	const supabase = getServerSupabase();
	const { searchParams } = new URL(req.url);
	const token_hash = searchParams.get("token_hash");
	const type = searchParams.get("type") as any;
	if (!token_hash || !type) return new Response("Invalid link", { status: 400 });
	const { error } = await supabase.auth.verifyOtp({ token_hash, type });
	if (error) return new Response(error.message, { status: 400 });
	return Response.redirect(new URL("/login", req.url));
}


