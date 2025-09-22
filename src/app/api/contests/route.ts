import { NextRequest } from "next/server";
import { getServerSupabase, getServerUser } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
    const supabase = getServerSupabase();
    const body = await req.json();
    const user = await getServerUser();
	if (!user) return new Response("Unauthorized", { status: 401 });
	// Minimal create to ensure route builds; full validation later
	const insert = {
		brand_id: user.id,
		title: body.title ?? "Sans titre",
		description: body.description ?? "",
		status: "draft",
		total_prize_cents: body.total_prize_cents ?? 0,
		created_at: new Date().toISOString(),
	};
	const { data, error } = await supabase.from("contests").insert(insert).select("id").single();
	if (error) return new Response(error.message, { status: 400 });
	return Response.json({ id: data.id });
}


