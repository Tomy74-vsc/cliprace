import { NextRequest } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
	const supabase = getAdminSupabase();
	const { data, error } = await supabase
		.from("leaderboards")
		.select("rank, submission_id, creator_id, views_weighted, prize_cents")
		.eq("contest_id", params.id)
		.order("rank", { ascending: true });
	if (error) return new Response(error.message, { status: 400 });
	return Response.json({ items: data ?? [] });
}


